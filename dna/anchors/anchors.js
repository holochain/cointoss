/*
    Anchors provide a set of functions that can be thought of as something like global application 
    variables. But unlike global application variables in non-distributed environments, with anchors, 
    the developer must consider and write appropriate validation rules for each anchor since they 
    are actually stored as entries on the chain.

    For details, see: https://github.com/Holochain/mixins/wiki/Anchors

    Notes to add to docs:

        - Can't use one call to removeFromList to remove multiple entries of same value but having different entry types
*/

// ********************************************************************************************************
// Holochain API
// since the virtual javascript environment (Auto) doesn't allow errors to be thrown, errors are returned
// as an object with a property of name set to "HolochainError". Therefore, we override all core Holochain 
// functions and if there was an error object returned, we throw it instead
// ********************************************************************************************************
var _core_remove=remove;remove=function(a,b){return checkForError("remove",_core_remove(a,b))};var _core_makeHash=makeHash;makeHash=function(a,b){return checkForError("makeHash",_core_makeHash(a,b))};var _core_debug=debug;debug=function(a){return checkForError("debug",_core_debug(a))};var _core_call=call;call=function(a,b,c){return checkForError("call",_core_call(a,b,c))};var _core_commit=commit;commit=function(a,b){return checkForError("commit",_core_commit(a,b))};var _core_get=get;get=function(a,b){return checkForError("get",b===undefined?_core_get(a):_core_get(a,b))};var _core_getLinks=getLinks;getLinks=function(a,b,c){return checkForError("getLinks",_core_getLinks(a,b,c))};function checkForError(func,rtn){if(typeof rtn==="object"&&rtn.name=="HolochainError"){var errsrc=new getErrorSource(4);var message='HOLOCHAIN ERROR! "'+rtn.message+'" on '+func+(errsrc.line===undefined?"":" in "+errsrc.functionName+" at line "+errsrc.line+", column "+errsrc.column);throw{name:"HolochainError",function:func,message:message,holochainMessage:rtn.message,source:errsrc,toString:function(){return this.message}}}return rtn}function getErrorSource(depth){try{throw new Error}catch(e){var line=e.stack.split("\n")[depth];var reg=/at (.*) \(.*:(.*):(.*)\)/g.exec(line);if(reg){this.functionName=reg[1];this.line=reg[2];this.column=reg[3]}}}
// ********************************************************************************************************

var _anchor_generic_ = "_anchor_generic_";

function genesis() {
    return true;
}

function set(parms) {

    var anchor = parms === undefined ? undefined : parms.anchor;
    var value = parms === undefined ? undefined : parms.value;
    var entryType = parms === undefined ? undefined : parms.entryType == undefined ? _anchor_generic_ : parms.entryType;
    var preserveOldValueEntry = parms === undefined ? undefined : parms.preserveOldValueEntry == undefined ? false : parms.preserveOldValueEntry;

    if (anchor == undefined)
        return new errorObject("anchor is a required parameter!");

    if (value == undefined)
        return new errorObject("value is a required parameter!");

    if (preserveOldValueEntry != true && preserveOldValueEntry != false)
        return new errorObject("preserveOldValueEntry must be true or false!");

    // if (parms.entryType === undefined)
    //     if (typeof value !== 'string' && !(value instanceof String))
    //         return new errorObject("If entryType is not specified, value must be a string");

    var anchor_hash = makeHash("anchor_base", anchor);
    var newAnchor = false;

    // Lookup the base entry
    try { var links = getLinks(anchor_hash, _anchor_generic_, { Load: true }); }

    catch (err) // getLink got an error
    {
        if (err.holochainMessage == "hash not found") // hash not found, create the base entry, and continue with empty links list
        {
            var anchor_hash = commit("anchor_base", anchor);
            links = [];
            newAnchor = true;
        }
        else if (err.holochainMessage == "No links for " + _anchor_generic_)
            return new errorObject("\"" + anchor + "\" is not a simple anchor link base!");
        else
            throw err; // other error, throw it

    }

    if (links.length != 1 && !newAnchor) // an existing Key/Value base entry will only always have just 1 link entry, no more, no less
        return new errorObject("\"" + anchor + "\" is not a simple anchor link base!");

    // if this is a generic entryType, always stringify it
    if (parms.entryType === undefined)
        value = JSON.stringify(value);

    // put the value on the chain
    var value_hash = commit(entryType, value);

    // if this is not a new key, delete the old value and link
    if (links.length == 1) {

        commit("anchor_link", { Links: [{ Base: anchor_hash, Link: links[0].Hash, Tag: _anchor_generic_, LinkAction: HC.LinkAction.Del }] });

        if (!preserveOldValueEntry)
            remove(links[0].Hash, "anchors-set");

    }

    // add the new value's link
    var link_hash = commit("anchor_link", { Links: [{ Base: anchor_hash, Link: value_hash, Tag: _anchor_generic_ }] });

    return anchor_hash;

}

// passthrough to core get() function... only needed for testing
var coreGet = get;

var get = function get(parms) {

    var anchor = parms === undefined ? undefined : parms.anchor;
    var anchorHash = parms === undefined ? undefined : parms.anchorHash;

    if (anchorHash == undefined) {
        if (anchor == undefined)
            return new errorObject("Must pass either anchor or anchorHash!");

        anchorHash = makeHash("anchor_base", anchor);
    }
    else if (anchor != undefined)
        return new errorObject("Can't pass both anchor and anchorHash!");

    // The value is stored by link reference with the anchor name as the base. Get it!
    try { var links = getLinks(anchorHash, _anchor_generic_, { Load: true }); }

    catch (err) {
        if (err.holochainMessage == "hash not found")
            return null;
        else if (err.holochainMessage == "No links for " + _anchor_generic_)
            return new errorObject("\"" + anchor + "\" is not a simple anchor link base!");

        throw err;
    }

    if (links.length == 0) return new errorObject("\"" + anchor + "\" is not a simple anchor link base because it has 0 links!");
    if (links.length > 1) return new errorObject("\"" + anchor + "\" is not a simple anchor link base because it has more than 1 link!");

    var rtn = links[0].Entry;

    // if the entry was stored with entryType of _anchor_generic_ then no entryType was specified on set, so we stringify'ed it at store time... parse it back!
    if (links[0].EntryType == _anchor_generic_)
        rtn = JSON.parse(rtn);

    return rtn;

};

function addToList(parms) {

    var anchor = parms === undefined ? undefined : parms.anchor;
    var value = parms === undefined ? undefined : parms.value;
    var entryType = parms === undefined ? undefined : parms.entryType == undefined ? _anchor_generic_ : parms.entryType;
    var index = parms === undefined ? undefined : parms.index == undefined ? _anchor_generic_ : JSON.stringify(parms.index);
    var preserveOldValueEntry = parms === undefined ? undefined : parms.preserveOldValueEntry == undefined ? false : parms.entryType;

    if (anchor == undefined)
        return new errorObject("anchor is a required parameter!");

    if (value == undefined)
        return new errorObject("value is a required parameter!");

    var anchor_hash = makeHash("anchor_base", anchor);

    // Lookup the base entry
    try { var links = getLinks(anchor_hash, index, { Load: false }); }

    catch (err) // getLink got an error
    {
        if (err.holochainMessage == "hash not found") // hash not found, create the base entry, and continue with empty links list
        {
            var anchor_hash = commit("anchor_base", anchor);

            if (isErr(anchor_hash)) // failed
                return anchor_hash;

            links = [];
        }
        else if (err.holochainMessage == "No links for " + (index === undefined ? "" : index)) // an index was specified and it doesn't exist
        {
            var x = "x"; // do nothing because that is just fine!
            links = [];
        }
        else {
            throw err; // other error, return it
        }

    }

    // if this is a generic entryType, always stringify it
    if (parms.entryType === undefined)
        value = JSON.stringify(value);

    // put the value on the chain
    var value_hash = commit(entryType, value);

    if (isErr(value_hash)) // failed
        return value_hash;

    // if index was specified, delete the old value by that index (if there was one)
    if (index != _anchor_generic_ && links.length == 1) {
        commit("anchor_link", { Links: [{ Base: anchor_hash, Link: links[0].Hash, Tag: index, LinkAction: HC.LinkAction.Del }] });

        if (!preserveOldValueEntry)
            remove(links[0].Hash, "anchors:addToList");
    }

    // add the new value's link
    var link_hash = commit("anchor_link", { Links: [{ Base: anchor_hash, Link: value_hash, Tag: index }] });

    return anchor_hash;

}

function getFromList(parms) {

    var anchor = parms === undefined ? undefined : parms.anchor;
    var anchorHash = parms === undefined ? undefined : parms.anchorHash;
    var index = parms === undefined ? undefined : parms.index == undefined ? undefined : JSON.stringify(parms.index);

    if (anchorHash == undefined) {
        if (anchor == undefined)
            return new errorObject("Must pass either anchor or anchorHash!");

        anchorHash = makeHash("anchor_base", anchor);
    }
    else if (anchor != undefined)
        return new errorObject("Can't pass both anchor and anchorHash!");

    // The value is stored by link reference with the anchor name as the base. Get it!
    try { var links = getLinks(anchorHash, index === undefined ? "" : index, { Load: true }); }

    catch (err)// failed
    {
        if (err.holochainMessage == "hash not found")
            return null;
        else if (err.holochainMessage == ("No links for " + (index === undefined ? "" : index))) // an index was specified and it doesn't exist
            return index === undefined ? [] : null;
        else
            throw err;
    }

    var rtn;

    if (index === undefined) { // an index was not specified
        rtn = [];

        hasIndexes = false;

        // check if any entries have indexes (tags other than _anchor_generic_)
        for (var x = 0; x < links.length; x++)
            if (links[x].Tag != _anchor_generic_) {
                hasIndexes = true;
                break;
            }

        for (var x = 0; x < links.length; x++) {
            var value = links[x].Entry;

            // if the entry was stored with entryType of _anchor_generic_ then no entryType was specified on addToList, so we stringify'ed it at store time... parse it back!
            if (links[x].EntryType == _anchor_generic_)
                value = JSON.parse(value);

            if (hasIndexes)
                rtn.push({ index: links[x].Tag == _anchor_generic_ ? _anchor_generic_ : JSON.parse(links[x].Tag), value: value });
            else
                rtn.push(value);

        }
    }
    else { // an index was specified
        var value = links[0].Entry;

        // if the entry was stored with no entryType, we stringify'ed it at store time... parse it back!
        if (links[0].EntryType == _anchor_generic_)
            value = JSON.parse(value);

        rtn = value;
    }

    return rtn;

}

// returns number of items removed
function removeFromList(parms) {

    var anchor = parms === undefined ? undefined : parms.anchor;
    var anchorHash = parms === undefined ? undefined : parms.anchorHash;
    var value = parms === undefined ? undefined : parms.value;
    var valueHash = parms === undefined ? undefined : parms.valueHash;
    var entryType = parms === undefined ? undefined : parms.entryType == undefined ? _anchor_generic_ : parms.entryType;
    var index = parms === undefined ? undefined : parms.index == undefined ? undefined : JSON.stringify(parms.index);
    var preserveOldValueEntry = parms === undefined ? undefined : parms.preserveOldValueEntry == undefined ? false : parms.preserveOldValueEntry;

    // PARAMETER VALIDATION *******************************

    // build valueHash if we didn't get one as a parameter
    if (valueHash === undefined && value !== undefined)
        if (entryType == _anchor_generic_) // if it's generic, we stringified it at store time
            valueHash = makeHash(entryType, JSON.stringify(value));
        else
            valueHash = makeHash(entryType, value);

    if (anchorHash === undefined) // didn't get an anchorHash
    {
        if (anchor === undefined)
            throw new errorObject("Must pass either anchor or anchorHash!");

        anchorHash = makeHash("anchor_base", anchor);
    }
    else if (anchor !== undefined) // got an anchor hash and an anchor
        throw new errorObject("Can't pass both anchor and anchorHash!");

    if (index === undefined) // didn't get an index
    {
        if (valueHash === undefined)
            throw new errorObject("Must pass either index or value or valueHash!");
    }
    else if (valueHash !== undefined) // got an index and a valueHash
        throw new errorObject("Can't pass both index and (value or valueHash)!");

    // ******************************************************

    // The variable value is stored by link reference with the anchor name as the base. Get it!
    var links = getLinks(anchorHash, index === undefined ? "" : index, { Load: true });

    if (isErr(links)) // failed
    {

        if (links.message == "hash not found")
            return new errorObject("Anchor does not exist!");
        else if (links.message == "No links for " + (index === undefined ? "" : index)) // an index was specified and it doesn't exist
            var x = "x"; // do nothing because that is just fine!
        else
            return links;
    }
    else if (links.length == 0)
        return 0; // nothing to do!

    if (index !== undefined)  // we got passed an index, so delete that one by tag
    {

        // we know there is only one because we check on addToList
        if (links.length > 1)
            return new errorObject("\"" + anchor + "\" is not an anchor list link base because it has more than 1 link with the same tag!");

        var result = removeLink(anchorHash, links[0].Hash, index, preserveOldValueEntry);

        if (isErr(result))
            return result;

        return 1;
    }
    else {
        var count = 0;

        for (var x = 0; x < links.length; x++) {
            if (links[x].Hash == valueHash) {
                // if there is more than one matching value and preserveOldEntry was set to false, set it to true after first link processed so as to avoid attempting to removeLink again
                removeLink(anchorHash, links[x].Hash, links[x].Tag, preserveOldValueEntry || count > 0);
                count++;
            }
        }

        return count;
    }

}

function removeLink(bashHash, hash, tag, preserveOldValueEntry) {
    var rtn = commit("anchor_link", { Links: [{ Base: bashHash, Link: hash, Tag: tag, LinkAction: HC.LinkAction.Del }] });

    if (!preserveOldValueEntry)
        remove(hash, "anchors:removeFromList");

    return rtn;
}

function makeAnchorHash(parms)
{
    if (parms.entryType === undefined)
        return makeHash(_anchor_generic_, JSON.stringify(parms.value));
    else
        return makeHash(parms.entryType, parms.value);
}

function errorObject(errorText) {
    this.name = "AnchorsError";
    this.message = errorText;

    function toString() {
        return this.message;
    }
}

// helper function to determine if value returned from holochain function is an error
function isErr(result) {
    return ((typeof result === 'object') && result.name == "HolochainError");
}


/*************
VALIDATION METHODS
**************/
function validatePut(entry_type, entry, header, pkg, sources) {
    return validate(entry_type, entry, header, sources);
}
function validateCommit(entry_type, entry, header, pkg, sources) {
    return validate(entry_type, entry, header, sources);
}
function validate(entry_type, entry, header, sources) {
    if (entry_type == "anchor_links" || entry_type == "anchor") {
        return true;
    }

    return true
}

function validateLink(linkingEntryType, baseHash, linkHash, tag, pkg, sources) {
    if (linkingEntryType == "anchor_links")
        return true;
    return true;
}

function validateMod(entry_type, hash, newHash, pkg, sources) { return false; }
function validateDel(entry_type, hash, pkg, sources) { return true; }
function validatePutPkg(entry_type) { return null }
function validateModPkg(entry_type) { return null }
function validateDelPkg(entry_type) { return null }
function validateLinkPkg(entry_type) { return null }


