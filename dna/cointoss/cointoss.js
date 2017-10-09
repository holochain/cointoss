/* Holochain API */ var _core_remove=remove;remove=function(a,b){return checkForError("remove",_core_remove(a,b))};var _core_makeHash=makeHash;makeHash=function(a,b){return checkForError("makeHash",_core_makeHash(a,b))};var _core_debug=debug;debug=function(a){return checkForError("debug",_core_debug(a))};var _core_call=call;call=function(a,b,c){return checkForError("call",_core_call(a,b,c))};var _core_commit=commit;commit=function(a,b){return checkForError("commit",_core_commit(a,b))};var _core_get=get;get=function(a,b){return checkForError("get",b===undefined?_core_get(a):_core_get(a,b))};var _core_getLinks=getLinks;getLinks=function(a,b,c){return checkForError("getLinks",_core_getLinks(a,b,c))};var _core_send=send;send=function(a,b,c){return checkForError("send",c===undefined?_core_send(a,b):_core_send(a,b,c))};function checkForError(func,rtn){if(typeof rtn==="object"&&rtn.name=="HolochainError"){var errsrc=new getErrorSource(4);var message='HOLOCHAIN ERROR! "'+rtn.message.toString()+'" on '+func+(errsrc.line===undefined?"":" in "+errsrc.functionName+" at line "+errsrc.line+", column "+errsrc.column);throw{name:"HolochainError",function:func,message:message,holochainMessage:rtn.message,source:errsrc,toString:function(){return this.message}}}return rtn}function getErrorSource(depth){try{throw new Error}catch(e){var line=e.stack.split("\n")[depth];var reg=/at (.*) \(.*:(.*):(.*)\)/g.exec(line);if(reg){this.functionName=reg[1];this.line=reg[2];this.column=reg[3]}}}
/* Anchors API */ function postCallProcess(rtn){return JSON.parse(rtn)}function setAnchor(anchor,value,entryType,preserveOldValueEntry){var parms={anchor:anchor,value:value};if(entryType!==undefined)parms.entryType=entryType;if(preserveOldValueEntry!==undefined)parms.preserveOldValueEntry=preserveOldValueEntry;return postCallProcess(call("anchors","set",parms))}function getAnchor(anchor,index,anchorHash){var parms={anchor:anchor};if(index!==undefined)parms.index=index;if(anchorHash!==undefined)parms.anchorHash=anchorHash;return postCallProcess(call("anchors","get",parms))}function addToListAnchor(anchor,value,entryType,index,preserveOldValueEntry){var parms={anchor:anchor,value:value};if(entryType!==undefined)parms.entryType=entryType;if(index!==undefined)parms.index=index;if(preserveOldValueEntry!==undefined)parms.preserveOldValueEntry=preserveOldValueEntry;return postCallProcess(call("anchors","addToList",parms))}function getFromListAnchor(anchor,index,anchorHash){var parms={anchor:anchor};if(index!==undefined)parms.index=index;if(anchorHash!==undefined)parms.anchorHash=anchorHash;return postCallProcess(call("anchors","getFromList",parms))}function removeFromListAnchor(anchor,value,entryType,index,preserveOldValueEntry,anchorHash,valueHash){var parms={anchor:anchor};if(value!==undefined)parms.value=value;if(entryType!==undefined)parms.entryType=entryType;if(index!==undefined)parms.index=index;if(preserveOldValueEntry!==undefined)parms.preserveOldValueEntry=preserveOldValueEntry;if(anchorHash!==undefined)parms.anchorHash=anchorHash;if(valueHash!==undefined)parms.valueHash=valueHash;return postCallProcess(call("anchors","removeFromList",parms))}function makeAnchorHash(value,entryType){var parms={value:value};if(entryType!==undefined)parms.entryType=entryType;return postCallProcess(call("anchors","makeAnchorHash",parms))}

// ==============================================================================
// EXPOSED Functions: visible to the UI, can be called via localhost, web browser, or socket
// ===============================================================================

var AppID = App.DNA.Hash;
var Me = App.Agent.Hash;

function whoAmI()
{
    return Me;
}

// set the handle of this node
function setHandle(handle) {

    // get old handle (if any)
    var oldHandle = getAnchor(Me + ":handle");

    // if there was one, remove old handle from directory by index
    if (oldHandle != null)
        removeFromListAnchor("userDirectory", undefined, undefined, oldHandle);

    // set handle
    setAnchor(Me + ":handle", handle);

    // Add the new handle to the directory
    addToListAnchor("userDirectory", Me, undefined, handle);

    return makeAnchorHash(handle);

}

// returns all the handles in the directory
function getHandles() {

    var rtn = getFromListAnchor("userDirectory");

    handles = [];

    for(var x=0; x < rtn.length; x++)
        handles.push({ handle: rtn[x].index, hash: rtn[x].value });

    handles.sort(function (a, b) {
        if (a.handle < b.handle)
            return -1;
        if (a.handle > b.handle)
            return 1;
        return 0;
    });

    return handles;

}

// returns the current handle of this node
function getMyHandle() {
    return getHandle(Me);
}

// returns the handle of an agent 
function getHandle(userHash) {
    return getAnchor(userHash + ":handle");
}

// gets the AgentID (userAddress) based on handle
function getAgent(handle) {
    return getFromListAnchor("userDirectory", handle);
}

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
function confirmToss(toss) {

    var rsp = get(toss, { GetMask: HC.GetMask.Sources + HC.GetMask.Entry + HC.GetMask.EntryType });
    if (rsp.EntryType == "toss") {
        var sources = rsp.Sources;
        var entry = JSON.parse(rsp.Entry);
        // check with the actual players in the record to get their seed values now that the
        // toss has been recorded publicly

        var iSeed = send(entry.initiator, { type: "seedReq", seedHash: entry.initiatorSeedHash, toss: toss });
        iSeed = confirmSeed(iSeed, entry.initiatorSeedHash);

        if (iSeed)
        {
            var rSeed = send(entry.responder, { type: "seedReq", seedHash: entry.responderSeedHash, toss: toss });
            rSeed = confirmSeed(rSeed, entry.responderSeedHash);
            if (rSeed)
            {
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

                return result;
            }
        }
    } 

    return "";
}

// return two node id's in alphabetical order
function orderNodeIds(initiator, responder) {
    return initiator < responder ? initiator + "|" + responder : responder + "|" + initiator;
}

// gets an array of toss_results of historical tosses against the specified node
function getTossHistory(parms) {

    var ordered_node_ids = orderNodeIds(Me, parms.responder);

    results = getLinkToArray(makeHash("history_link_base", ordered_node_ids), "toss_result");

    var sortable = [];

    for (var entry in results)
    {
        var toss = JSON.parse(get(results[entry].toss));
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

    // initialize return variable
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
        links_filled[links[i].Hash] = JSON.parse(links[i].Entry);
    }

    return links_filled;
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
            var entry = JSON.parse(rsp.Entry);
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



