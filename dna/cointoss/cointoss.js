
// ==============================================================================
// EXPOSED Functions: visible to the UI, can be called via localhost, web browser, or socket
// ===============================================================================

var Me = App.Key.Hash;

function whoAmI()
{
    return Me;
}


// Handles / Anchors
// ===============================================================================

// set the handle of this node
function setHandle(handle) {
  var handles = getLinks(App.Key.Hash, 'handle');
  if (handles.length > 0) {
    if (anchorExists('handle', handle) === 'false') {
      var oldKey = handles[0].Hash;
      var key = update('handle', anchor('handle', handle), oldKey);
      commit('handle_links', {
        Links: [
          {
            Base: App.Key.Hash,
            Link: oldKey,
            Tag: 'handle',
            LinkAction: HC.LinkAction.Del
          },
          { Base: App.Key.Hash, Link: key, Tag: 'handle' }
        ]
      });
      commit('directory_links', {
        Links: [
          {
            Base: App.DNA.Hash,
            Link: oldKey,
            Tag: 'handle',
            LinkAction: HC.LinkAction.Del
          },
          { Base: App.DNA.Hash, Link: key, Tag: 'handle' }
        ]
      });
      return key;
    } else {
      // debug('HandleInUse')
      return 'HandleInUse';
    }
  }
  if (anchorExists('handle', handle) === 'false') {
    var newHandleKey = commit('handle', anchor('handle', handle));
    commit('handle_links', {
      Links: [{ Base: App.Key.Hash, Link: newHandleKey, Tag: 'handle' }]
    });
    commit('directory_links', {
      Links: [{ Base: App.DNA.Hash, Link: newHandleKey, Tag: 'directory' }]
    });
    return newHandleKey;
  } else {
    // debug('HandleInUse')
    return 'HandleInUse';
  }
}


// returns the current handle of this node
function getMyHandle() {
    return getHandle(Me);
}


// returns the handle of an agent by looking it up on the user's DHT entry, the last handle will be the current one?
function getHandle(agentKey) {
  var links = getLinks(agentKey, 'handle', { Load: true });
  // debug(links);
  if (links.length > 0) {
    var anchorHash = links[0].Entry.replace(/"/g, '');
    return get(anchorHash).anchorText;
  } else {
    return '';
  }
}


// returns all the handles in the directory
function getHandles() {
  var links = getLinks(App.DNA.Hash, 'directory', { Load: true });
  // debug(links);
  var handles = [];
  for (var i = 0; i < links.length; i++) {
    var handleHash = links[i].Source;
    var handle = get(links[i].Entry).anchorText;
    // debug(handle + ' handle');
    handles.push({ handleHash: handleHash, handle: handle });
  }
  return handles;
}


// gets the AgentID (userAddress) based on handle
function getAgent(handle) {
  if (anchorExists('handle', handle) === 'false') {
    return '';
  } else {
    return get(anchor('handle', handle), { GetMask: HC.GetMask.Sources })[0];
  }
}


// Commits
// ===============================================================================

function commitToss(initiator, initiatorSeed, responder, responderSeed, call) {
    var toss = { initiator: initiator, initiatorSeedHash: initiatorSeed, responder: responder, responderSeedHash: responderSeed, call: call };
    return commit("toss", toss);
}

function commitSeed() {
    var salt = "" + Math.random() + "" + Math.random();
    return commit("seed", salt + "-" + Math.floor(Math.random() * 10));
}

// initiates node2node communication with an agent to commit
// seeds values for the toss, followed by the toss entry itself afterwards
function requestToss(req) {

    var mySeed = commitSeed();
    var response = JSON.parse(send(req.agent, { type: "tossReq", seed: mySeed }));

    // create our own copy of the toss according to the seed and call from the responder
    var theToss = commitToss(App.Key.Hash, mySeed, req.agent, response.seed, response.call);
    if (theToss != response.toss) {
        return { error: "toss didn't match!" };
    }
    return { toss: theToss };
}

function confirmSeed(seed, seedHash) {
    seed = JSON.parse(seed);
    var h = makeHash("seed", seed);
    return (h == seedHash) ? seed : undefined;
}

// initiates node2node communication with an agent to retrieve the actual seed values
// after they were committed so we can find out what the toss actually was
function confirmToss(toss)
{
    var rsp = get(toss, { GetMask: HC.GetMask.Sources + HC.GetMask.Entry + HC.GetMask.EntryType });
    if (rsp.EntryType !== "toss")
    {
      debug("confirmToss failed: " + rsp.EntryType);
      return "";
    }
    var entry = rsp.Entry;
    // check with the actual players in the record to get their seed values now that the
    // toss has been recorded publicly
    var iSeed = send(entry.initiator, { type: "seedReq", seedHash: entry.initiatorSeedHash, toss: toss });
    iSeed = confirmSeed(iSeed, entry.initiatorSeedHash);
    if (!iSeed)
    {
      return "";
    }

    var rSeed = send(entry.responder, { type: "seedReq", seedHash: entry.responderSeedHash, toss: toss });
    rSeed = confirmSeed(rSeed, entry.responderSeedHash);
    if (!rSeed)
    {
      return "";
    }

    var i = parseInt(iSeed.split("-")[1]);
    var r = parseInt(rSeed.split("-")[1]);

    // compare the odd/evenness of the addition of the two seed values to the call
    var sum = (i + r);
    var result = ((sum % 2 == 0) == entry.call) ? "win" : "loss";

    // commit toss result
    var toss_result_hash = commit("toss_result", {
        "toss": toss,
        "result": result,
        "timeStamp": Date.now()
    });

    // make sure history_link_base exists for this handle pair
    var ordered_node_ids = orderNodeIds(entry.initiator, entry.responder); // use only one history record per pair by ordering alphabetically
    var history_link_base_hash = commit("history_link_base", ordered_node_ids);

    // write toss result to the history
    var history_link_hash = commit("history_links", { Links: [{ Base: history_link_base_hash, Link: toss_result_hash, Tag: "toss_result" }] });
    if(isErr(history_link_hash) || isErr(history_link_base_hash))
    {
        debug("\t commit failed: " + JSON.stringify(history_link_base_hash) + " | " + JSON.stringify(history_link_hash));
    }
    return result;
}


// return two node id's in alphabetical order
function orderNodeIds(initiator, responder) {
    return initiator < responder ?
        initiator + "|" + responder
      : responder + "|" + initiator;
}

// gets an array of toss_results of historical tosses against the specified node
function getTossHistory(parms) {
    var ordered_node_ids = orderNodeIds(Me, parms.responder);
    var linkHash = makeHash("history_link_base", ordered_node_ids);
    var results = getLinkToArray(linkHash, "toss_result");

    var sortable = [];
    for (var entry in results)
    {
        var toss            = get(results[entry].toss);
        var initiatorHandle = getHandle(toss.initiator);
        var responderHandle = getHandle(toss.responder);

        var resultText = (results[entry].result == "win") ? "won" : "lost";

        results[entry].textDescription = initiatorHandle + " " + resultText + " against " + responderHandle;
        results[entry].htmlDescription = "<u>" + initiatorHandle + "</u> <b>" + resultText + "</b> against <u>" + responderHandle + "</u>";

        sortable.push(results[entry]);
    }

    sortable.sort(function (a, b) {
        return b.timeStamp - a.timeStamp;
    });
    return sortable;
}

function winLose(str) {
    // calculate hash of string
    var hash = 0;
    for (i = 0; i < str.length; i++) {
        char = str.charCodeAt(i);
        hash = char + (hash << 6) + (hash << 16) - hash;
    }
    return hash;
}

// ==============================================================================
// HELPERS: unexposed functions
// ==============================================================================

// helper function to do getLink call, handle the no-link error case, and copy the returned entry values into a nicer array
function getLinkToArray(base, tag) {
    var links_filled = {};

    // get the tag from the base in the DHT
    try { var links = getLinks(base, tag, { Load: true }); }
    catch(err)
    {
        if (err.holochainMessage == "hash not found")
            return [];
        else
            throw err;
    }

    for (var i = 0; i < links.length; i++) {
        links_filled[links[i].Hash] = links[i].Entry;
    }

    return links_filled;
}


function anchor(anchorType, anchorText) {
  return call('anchors', 'anchor', {
    anchorType: anchorType,
    anchorText: anchorText
  }).replace(/"/g, '');
}


function anchorExists(anchorType, anchorText) {
  return call('anchors', 'exists', {
    anchorType: anchorType,
    anchorText: anchorText
  });
}


// ==============================================================================
// CALLBACKS: Called by back-end system, instead of front-end app or UI
// ===============================================================================

// GENESIS - Called only when your source chain is generated:'hc gen chain <name>'
// ===============================================================================
function genesis() {                            // 'hc gen chain' calls the genesis function in every zome file for the app
    setHandle(App.Agent.String);
    return true;
}

// listen for a toss request
function receive(from, msg) {
    var type = msg.type;
    if (type == 'tossReq') {
        var mySeed = commitSeed();
        // call whether we want head or tails randomly.
        var call = Math.floor(Math.random() * 10) % 2 == 0;
        var theToss = commitToss(from, msg.seed, App.Key.Hash, mySeed, call);
        return { seed: mySeed, toss: theToss, call: call };
    } else if (type == "seedReq") {
        // make sure I committed toss and the seed hash is one of the seeds in the commit
        var rsp = get(msg.toss, { Local: true, GetMask: HC.GetMask.EntryType + HC.GetMask.Entry });
        if (rsp.EntryType == "toss") {
            var entry = rsp.Entry;
            if (entry.initiatorSeedHash == msg.seedHash || entry.responderSeedHash == msg.seedHash) {
                // if so then I can reveal the seed
                var seed = get(msg.seedHash, { Local: true, GetMask: HC.GetMask.Entry });
                return seed;
            }
        }
    }
    return null;
}

// ===============================================================================
//   VALIDATION functions for *EVERY* change made to DHT entry -
//     Every DHT node uses their own copy of these functions to validate
//     any and all changes requested before accepting. put / mod / del & metas
// ===============================================================================

function validateCommit(entry_type, entry, header, pkg, sources) {
    return validate(entry_type, entry, header, sources);
}

function validatePut(entry_type, entry, header, pkg, sources) {
    return validate(entry_type, entry, header, sources);
}

function validate(entry_type, entry, header, sources) {
    if (entry_type == "handle") {
        return true;
    }
    return true;
}

//
function validateLink(linkEntryType, baseHash, links, pkg, sources) {

    if (linkEntryType == "key_value_link") {

        if (links.length != 1) return false; // there will always on be just one link
        if (links[0].LinkAction == HC.LinkAction.Upd) return false; // we do not do updates
        if (links[0].Base != baseHash) return false; // the base must be this base
        if (links[0].Tag != "value") return false; // The tag name should be "value"

        // source must be same as the base creator
        var base = get(baseHash, { GetMask: HC.GetMask.Sources });
        if (isErr(base) || base == undefined || base.length != 1 || base[0] != sources[0]) return false;

        return true;
    }

    return true;
}
function validateMod(entry_type, entry, header, replaces, pkg, sources) {
    return true;
}
function validateDel(entry_type, hash, pkg, sources) {
    return true;
}

// ===============================================================================
//   PACKAGING functions for *EVERY* validation call for DHT entry
//     What data needs to be sent for each above validation function?
//     Default: send and sign the chain entry that matches requested HASH
// ===============================================================================

function validatePutPkg(entry_type)  { return null; }
function validateModPkg(entry_type)  { return null; }
function validateDelPkg(entry_type)  { return null; }
function validateLinkPkg(entry_type) { return null; }
