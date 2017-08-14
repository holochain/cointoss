// ==============================================================================
// EXPOSED Functions: visible to the UI, can be called via localhost, web browser, or socket
// ===============================================================================

function appProperty(name) {
    if (name == "App_Agent_Hash") {return App.Agent.Hash;}
    if (name == "App_Agent_String")  {return App.Agent.String;}
    if (name == "App_Key_Hash")   {return   App.Key.Hash;}
    if (name == "App_DNA_Hash")   {return   App.DNA.Hash;}
    return "Error: No App Property with name: " + name;
}

// set the handle of this node
function setHandle(handle) {

    // Lookup the stuff we need
    var oldHandle = getValueOfKey(App.Key.Hash + ":handle");
    var directory = getDirectory();

    // Set the handle
    var handle_hash = setValueOfKey(App.Key.Hash + ":handle", "handle", handle).valueHash;

    // Remove the old handle from the directory if there was one
    if (oldHandle != null)
    {
        commit("directory_links",
            {Links:[
                {Base:directory,Link:makeHash(oldHandle),Tag:"handle",LinkAction:HC.LinkAction.Del},
            ]});
   }
    
    // Add the new handle to the directory
    commit("directory_links",
        {Links:[
            {Base:directory,Link:handle_hash,Tag:"handle"}
        ]});

    return handle_hash;

}

// returns all the handles in the directory
function getHandles() {
    var directory = getDirectory();
    var links = doGetLinkLoad(directory,"handle");

    var handles = [];
    for (var i=0;i <links.length;i++) {
        var h = links[i].handle;
        handles.push({handle:h,agent:getAgent(h)});
    }
    handles.sort(function (a,b) {
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
    return getHandle(App.Key.Hash);
}

// returns the handle of an agent 
function getHandle(userHash) {
    return getValueOfKey(userHash + ":handle");
}

// returns the agent associated agent by converting the handle to a hash
// and getting that hash's source from the DHT
function getAgent(handle) {
    var handleHash = makeHash(handle);
    var sources = get(handleHash,{GetMask:HC.GetMask.Sources});

    if (isErr(sources)) {sources = [];}
    if (sources != undefined) {
        var n = sources.length -1;
        return (n >= 0) ? sources[n] : "";
    }
    return "";
}

function commitToss(initiator,initiatorSeed,responder,responderSeed,call) {
    var toss = {initiator:initiator,initiatorSeedHash:initiatorSeed,responder:responder,responderSeedHash:responderSeed,call:call};
    return commit("toss",JSON.stringify(toss));
}

function commitSeed() {
    var salt = ""+Math.random()+""+Math.random();
    return commit("seed",salt+"-"+Math.floor(Math.random()*10));
}

// initiates node2node communication with an agent to commit
// seeds values for the toss, followed by the toss entry itself afterwards
function requestToss(req) {
    var mySeed = commitSeed();
    var response = send(req.agent,{type:"tossReq",seed:mySeed});
    debug("requestToss response:"+response);
    response = JSON.parse(response);
    // create our own copy of the toss according to the seed and call from the responder
    var theToss = commitToss(App.Key.Hash,mySeed,req.agent,response.seed,response.call);
    if (theToss != response.toss) {
        return {error:"toss didn't match!"};
    }
    return {toss:theToss};
}

function confirmSeed(seed,seedHash) {
    seed = JSON.parse(seed);
    var h = makeHash(seed);
    return (h == seedHash) ? seed :undefined;
}

// initiates node2node communication with an agent to retrieve the actual seed values
// after they were committed so we can find out what the toss actually was
function confirmToss(toss) {
    var rsp = get(toss,{GetMask:HC.GetMask.Sources+HC.GetMask.Entry+HC.GetMask.EntryType});
    if (!isErr(rsp) && rsp.EntryType == "toss") {
        var sources = rsp.Sources;
        var entry = JSON.parse(rsp.Entry);
        // check with the actual players in the record to get their seed values now that the
        // toss has been recorded publicly

        var iSeed = send(entry.initiator,{type:"seedReq",seedHash:entry.initiatorSeedHash,toss:toss});
        iSeed = confirmSeed(iSeed,entry.initiatorSeedHash);
        if (iSeed) {
            var rSeed = send(entry.responder,{type:"seedReq",seedHash:entry.responderSeedHash,toss:toss});
            rSeed = confirmSeed(rSeed,entry.responderSeedHash);
            if (rSeed) {
                var i = parseInt(iSeed.split("-")[1]);
                var r = parseInt(rSeed.split("-")[1]);
                // compare the odd evenness of the addition of the two seed values to the call
                var sum = (i+r);
                debug("call was:"+entry.call);
                debug("and sum of seed is:"+sum);
                var result = ((sum%2==0) == entry.call) ? "win" : "loss";
                debug("so responder gets a "+result);

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
                var history_link_hash = commit("history_links",
                    {Links:[
                        {Base:history_link_base_hash,Link:toss_result_hash,Tag:"toss_result"}
                    ]});

                return result;
            }
        }
    } else {
        debug("confirmToss: error getting toss or bad type:"+JSON.stringify(rsp));
    }
    return "";
}

// return two node id's in alphabetical order
function orderNodeIds(initiator, responder) {
    return initiator < responder ? initiator + "|" + responder : responder + "|" + initiator;
}

// gets an array of toss_results of historical tosses against the specified node
function getTossHistory(parms)
{
    var ordered_node_ids = orderNodeIds(App.Key.Hash, parms.responder);

    results = doGetLinkLoadJsonToAssocArray(makeHash(ordered_node_ids), "toss_result");

    var sortable = [];
    for (var entry in results) {
        var toss = JSON.parse(get(results[entry].toss));
        var initiatorHandle = getHandle(toss.initiator);
        var responderHandle = getHandle(toss.responder);

        var resultText = (results[entry].result == "win") ? "won" : "lost";

        results[entry].textDescription = initiatorHandle + " " + resultText + " against " + responderHandle;
        results[entry].htmlDescription = "<u>" + initiatorHandle + "</u> <b>" + resultText + "</b> against <u>" + responderHandle + "</u>";

        sortable.push(results[entry]);
    }

    sortable.sort(function(a, b) {
        return b.timeStamp - a.timeStamp;
    });

    return sortable;

}

function winLose(str){
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


// helper function to resolve which has will be used as "me"
function getMe() {return App.Key.Hash;}

// helper function to resolve which hash will be used as the base for the directory
// currently we just use the DNA hash as our entry for linking the directory to
// TODO commit an anchor entry explicitly for this purpose.
function getDirectory() {return App.DNA.Hash;}


// helper function to determine if value returned from holochain function is an error
function isErr(result) {
    return ((typeof result === 'object') && result.name == "HolochainError");
}

// helper function to do getLink call, handle the no-link error case, and copy the returned entry values into a nicer array
function doGetLinkLoadJsonToAssocArray(base, tag) {
    // initialize return variable
    var links_filled = {};

    // get the tag from the base in the DHT
    var links = getLink(base, tag,{Load:true});

    if (!isErr(links))
    {
        links = links.Links;

        for (var i=0;i <links.length;i++) {
            var link = {H:links[i].H};
            link[tag] = links[i].E;
            links_filled[links[i].H] = JSON.parse(links[i].E);
        }
    }

    return links_filled;
}

function doGetLinkLoad(base, tag) {
    // get the tag from the base in the DHT
    var links = getLink(base, tag,{Load:true});
    if (isErr(links)) {
        links = [];
    } else {
        links = links.Links;
    }
    var links_filled = [];
    for (var i=0;i <links.length;i++) {
        var link = {H:links[i].H};
        link[tag] = links[i].E;
        links_filled.push(link);
    }

    return links_filled;
}

// helper function to call getLinks, handle the no links entry error, and build a simpler links array.
function doGetLink(base,tag) {

    // get the tag from the base in the DHT
    var links = getLink(base, tag,{Load:true});
    if (isErr(links)) {
        links = [];
    }
     else {
        links = links.Links;
    }

    var links_filled = [];

    for (var i=0;i <links.length;i++) {
        links_filled.push(links[i].H);
    }
    return links_filled;
}

// Set a chain-based variable identified by a string (key) to a specified value
// returns an object with a boolean success property 
function setValueOfKey(key, entryType, value)
{

    // Lookup the base entry
    var links = getLink(makeHash(key), "value", {Load:true});

    if (isErr(links)) // got none, create the base entry, and continue with empty links list
    { 
        commit("key_value_link_base", key);
        links = {Links:[]};
    }

    if (links.length > 1) // an existing Key/Value base entry will only always have just 1 link entry, no more, no less
        return { success:false, error: { message:"\"" + key + "\" is not a Key/Value Pair link base!" } };

    // put the value on the chain
    var value_hash = commit(entryType, value);

    if (isErr(value_hash)) // failed
        return { success: false, error: value_hash };

    // if there is not a new key, delete the old value's link
    if (links.Links.length == 1)
    {
        commit("key_value_link",
            { Links:[
                { Base:makeHash(key),Link:links.Links[0].H, Tag:"value",LinkAction:HC.LinkAction.Del }
            ]});
    }

    // add the new value's link
    var link_hash = commit("key_value_link",
        { Links:[
            { Base:makeHash(key),Link:value_hash, Tag:"value" }
        ]});

    return { success:true, linkHash:link_hash, valueHash:value_hash };
    
}

// Get a chain-based variable identified by a string (key)
function getValueOfKey(key)
{

    // The variable value is stored by link reference with the key as the base. Get it!
    var links = getLink(makeHash(key), "value", {Load:true});

    // TODO: Add nicer error handling
    
    if (isErr(links)) return null;
    if (links.Links.length == 0) return null;
    if (links.Links.length > 1) return null;

    return links.Links[0].E;
    
}


// ==============================================================================
// CALLBACKS: Called by back-end system, instead of front-end app or UI
// ===============================================================================

// GENESIS - Called only when your source chain is generated:'hc gen chain <name>'
// ===============================================================================
function genesis() {                            // 'hc gen chain' calls the genesis function in every zome file for the app

    // use the agent string (usually email) used with 'hc init' to identify myself and create a new handle
    setHandle(App.Agent.String);
    //commit("anchor",{type:"sys",value:"directory"});
    return true;
}

// listen for a toss request
function receive(from,msg) {
    var type = msg.type;
    if (type=='tossReq') {
        var mySeed = commitSeed();
        // call whether we want head or tails randomly.
        var call = Math.floor(Math.random()*10)%2 == 0;
        var theToss = commitToss(from,msg.seed,App.Key.Hash,mySeed,call);
        return {seed:mySeed,toss:theToss,call:call};
    } else if (type=="seedReq") {
        // make sure I committed toss and the seed hash is one of the seeds in the commit
        var rsp = get(msg.toss,{Local:true,GetMask:HC.GetMask.EntryType+HC.GetMask.Entry});
        if (!isErr(rsp) && rsp.EntryType == "toss") {
            var entry = JSON.parse(rsp.Entry);
            if (entry.initiatorSeedHash == msg.seedHash || entry.responderSeedHash == msg.seedHash) {
                // if so then I can reveal the seed
                var seed = get(msg.seedHash,{Local:true,GetMask:HC.GetMask.Entry});
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

function validateCommit(entry_type,entry,header,pkg,sources) {
    debug("validate commit: "+entry_type);
    return validate(entry_type,entry,header,sources);
}

function validatePut(entry_type,entry,header,pkg,sources) {
    debug("validate put: "+entry_type);
    return validate(entry_type,entry,header,sources);
}

function validate(entry_type,entry,header,sources) {
    if (entry_type=="handle") {
        return true;
    }
    return true;
}

// Are there types of tags that you need special permission to add links?
// Examples:
//   - Only Bob should be able to make Bob a "follower" of Alice
//   - Only Bob should be able to list Alice in his people he is "following"
function validateLink(linkEntryType,baseHash,links,pkg,sources){
    debug("validate link: "+linkEntryType);
    if (linkEntryType=="handle_links") {
        var length = links.length;
        // a valid handle is when:

        // there should just be one or two links only
        if (length==2) {
            // if this is a modify it will have two links the first of which
            // will be the del and the second the new link.
            if (links[0].LinkAction != HC.LinkAction.Del) return false;
            if (links[1].LinkAction != HC.LinkAction.Add) return false;
        } else if (length==1) {
            // if this is a new handle, there will just be one Add link
            if (links[0].LinkAction != HC.LinkAction.Add) return false;
        } else {return false;}

        for (var i=0;i<length;i++) {
            var link = links[i];
            // the base must be this base
            if (link.Base != baseHash) return false;
            // the base must be the source
            if (link.Base != sources[0]) return false;
            // The tag name should be "handle"
            if (link.Tag != "handle") return false;
            //TODO check something about the link, i.e. get it and check it's type?
        }
        return true;
    }
    return true;
}
function validateMod(entry_type,entry,header,replaces,pkg,sources) {
    debug("validate mod: "+entry_type+" header:"+JSON.stringify(header)+" replaces:"+JSON.stringify(replaces));
    if (entry_type == "handle") {
        // check that the source is the same as the creator
        // TODO we could also check that the previous link in the type-chain is the replaces hash.
        var orig_sources = get(replaces,{GetMask:HC.GetMask.Sources});
        if (isErr(orig_sources) || orig_sources == undefined || orig_sources.length !=1 || orig_sources[0] != sources[0]) {return false;}

    }
    return true;
}
function validateDel(entry_type,hash,pkg,sources) {
    debug("validate del: "+entry_type);
    return true;
}

// ===============================================================================
//   PACKAGING functions for *EVERY* validation call for DHT entry
//     What data needs to be sent for each above validation function?
//     Default: send and sign the chain entry that matches requested HASH
// ===============================================================================

function validatePutPkg(entry_type) {return null;}
function validateModPkg(entry_type) { return null;}
function validateDelPkg(entry_type) { return null;}
function validateLinkPkg(entry_type) { return null;}
