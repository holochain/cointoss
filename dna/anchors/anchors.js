/*
    Anchors provide a set of functions that can be thought of as something like global application 
    variables. But unlike global application variables in non-distributed environments, with anchors, 
    the developer must consider and write appropriate validation rules for each anchor since they 
    are actually stored as entries on the chain.

    Anchors allow entries to be stored without needing to define a special entry type for the "base"
    which would be needed if standard links were to be used.

    List anchors are for more "proper" lists with expected behavior from non-hash-keyed storage 
    mechanisms. You can add the same item as many times to an Anchor list, and as with all anchors,
    the list can be referenced by a string name.

    For details, see: https://github.com/Holochain/mixins/wiki/Anchors

    Notes to add to docs:

        - Can't use one call to removeFromList to remove multiple entries of same value but having different entry types
*/

/* Holocain API */ var _core_remove=remove;remove=function(a,b){return checkForError("remove",_core_remove(a,b))};var _core_makeHash=makeHash;makeHash=function(a,b){return checkForError("makeHash",_core_makeHash(a,b))};var _core_debug=debug;debug=function(a){return checkForError("debug",_core_debug(JSON.stringify(a)))};var _core_call=call;call=function(a,b,c){return __holochain_api_check_for_json(checkForError("call",_core_call(a,b,c)))};var _core_commit=commit;commit=function(a,b){return checkForError("commit",_core_commit(a,b))};var _core_get=get;get=function(a,b){return __holochain_api_check_for_json(checkForError("get",b===undefined?_core_get(a):_core_get(a,b)))};var _core_getLinks=getLinks;getLinks=function(a,b,c){return checkForError("getLinks",_core_getLinks(a,b,c))};var _core_send=send;send=function(a,b,c){return __holochain_api_check_for_json(checkForError("send",c===undefined?_core_send(a,b):_core_send(a,b,c)))};function __holochain_api_check_for_json(rtn){try{rtn=JSON.parse(rtn)}catch(err){}return rtn}function checkForError(func,rtn){if(typeof rtn==="object"&&rtn.name=="HolochainError"){var errsrc=new getErrorSource(4);var message='HOLOCHAIN ERROR! "'+rtn.message.toString()+'" on '+func+(errsrc.line===undefined?"":" in "+errsrc.functionName+" at line "+errsrc.line+", column "+errsrc.column);throw{name:"HolochainError",function:func,message:message,holochainMessage:rtn.message,source:errsrc,toString:function(){return this.message}}}return rtn}function getErrorSource(depth){try{throw new Error}catch(e){var line=e.stack.split("\n")[depth];var reg=/at (.*) \(.*:(.*):(.*)\)/g.exec(line);if(reg){this.functionName=reg[1];this.line=reg[2];this.column=reg[3]}}}

// script globals
var ANCHOR_GENERIC = "_anchor_generic_";
var ENTRY_TYPE_PROP_NAME = "__ANCHORS_ENTRY_TYPE__";
var ANCHOR_DELIMETER = "_-_anchor_delimeter_-_";

function genesis() {
    return true;
}

function set(parms) {

    var anchor = parms === undefined ? undefined : parms.anchor;
    var value = parms === undefined ? undefined : parms.value;
    var entryType = parms === undefined ? undefined : parms.entryType == undefined ? ANCHOR_GENERIC : parms.entryType;
    var preserveOldValueEntry = parms === undefined ? undefined : parms.preserveOldValueEntry == undefined ? false : parms.preserveOldValueEntry;
    var anchorHash = parms === undefined ? undefined : parms.anchorHash;
    var valueHash = parms === undefined ? undefined : parms.valueHash;

    if (preserveOldValueEntry != true && preserveOldValueEntry != false)
        throw new errorObject("preserveOldValueEntry must be true or false!");

    if (anchorHash == undefined) {
        if (anchor == undefined)
            throw new errorObject("Must pass either anchor or anchorHash!");

        anchorHash = makeHash("anchor_base", anchor);
    }
    else if (anchor != undefined)
        throw new errorObject("Can't pass both anchor and anchorHash!");

    var newAnchor = false;

    // Lookup the base entry
    try { var links = getLinks(anchorHash, ANCHOR_GENERIC, { Load: true }); }

    catch (err) // getLink got an error
    {
        if (err.holochainMessage == "hash not found") // hash not found, create the base entry, and continue with empty links list
        {
            var anchorHash = commit("anchor_base", anchor);
            links = [];
            newAnchor = true;
        }
        else if (err.holochainMessage == "No links for " + ANCHOR_GENERIC)
            throw new errorObject("\"" + anchor + "\" is not a simple anchor link base!");
        else
            throw err; // other error, throw it

    }

    if (links.length != 1 && !newAnchor) // an existing Key/Value base entry will only always have just 1 link entry, no more, no less
        throw new errorObject("\"" + anchor + "\" is not a simple anchor link base!");

    // validate value parameters and generate valueHash if needed
    if (valueHash == undefined) {
        if (value == undefined)
            throw new errorObject("Must pass either value or valueHash!");

        valueHash = commit(entryType, value);
    }
    else if (value != undefined)
        throw new errorObject("Can't pass both value and valueHash!");

    // if this is not a new key, delete the old value and link
    if (links.length == 1) {

        commit("anchor_link", { Links: [{ Base: anchorHash, Link: links[0].Hash, Tag: ANCHOR_GENERIC, LinkAction: HC.LinkAction.Del }] });

        if (!preserveOldValueEntry)
            remove(links[0].Hash, "anchors-set");

    }

    // add the new value's link
    var link_hash = commit("anchor_link", { Links: [{ Base: anchorHash, Link: valueHash, Tag: ANCHOR_GENERIC }] });

    return { anchorHash: anchorHash, valueHash: valueHash, linkHash: link_hash };

}

// passthrough to core get() function... only needed for testing
var coreGet = get;

var get = function get(parms) {

    var anchor = parms === undefined ? undefined : parms.anchor;
    var anchorHash = parms === undefined ? undefined : parms.anchorHash;

    if (anchorHash == undefined) {
        if (anchor == undefined)
            throw new errorObject("Must pass either anchor or anchorHash!");

        anchorHash = makeHash("anchor_base", anchor);
    }
    else if (anchor != undefined)
        throw new errorObject("Can't pass both anchor and anchorHash!");

    // The value is stored by link reference with the anchor name as the base. Get it!
    try { var links = getLinks(anchorHash, ANCHOR_GENERIC, { Load: true }); }

    catch (err) {
        if (err.holochainMessage == "hash not found")
            return null;
        else if (err.holochainMessage == "No links for " + ANCHOR_GENERIC)
            throw new errorObject("\"" + anchor + "\" is not a simple anchor link base!");

        throw err;
    }

    if (links.length == 0) throw new errorObject("\"" + anchor + "\" is not a simple anchor link base because it has 0 links!");
    if (links.length > 1) throw new errorObject("\"" + anchor + "\" is not a simple anchor link base because it has more than 1 link!");

    return links[0].Entry;

};

function addToList(parms) {

    var anchor = parms === undefined ? undefined : parms.anchor;
    var value = parms === undefined ? undefined : parms.value;
    var entryType = parms === undefined ? undefined : parms.entryType == undefined ? ANCHOR_GENERIC : parms.entryType;
    var preserveOldValueEntry = parms === undefined ? undefined : parms.preserveOldValueEntry == undefined ? false : parms.preserveOldValueEntry;
    var anchorHash = parms === undefined ? undefined : parms.anchorHash;
    var valueHash = parms === undefined ? undefined : parms.valueHash;

    if (anchorHash == undefined) {
        if (anchor == undefined)
            throw new errorObject("Must pass either anchor or anchorHash!");

        anchorHash = makeHash("anchor_base", anchor);
    }
    else if (anchor != undefined)
        throw new errorObject("Can't pass both anchor and anchorHash!");

    // validate value parameters and generate valueHash if needed
    if (valueHash == undefined) {
        if (value == undefined)
            throw new errorObject("Must pass either value or valueHash!");

        valueHash = commit(entryType, value);
    }
    else if (value != undefined)
        throw new errorObject("Can't pass both value and valueHash!");

    // use a random tag so we get a unique link hash with every entry ensuring they are part of the list
    var tag = entryType + ANCHOR_DELIMETER + makeRandomString(16);

    // loop until we have a non-existing tag, will virtually always be first try
    while(true)
    {
        // check the base entry and tag
        try { var links = getLinks(anchorHash, tag, { Load: false }); }

        catch (err) 
        {
            if (err.holochainMessage == "hash not found") // hash not found, create the base entry, and BREAK OUT OF THE LOOP!
            {
                var anchorHash = commit("anchor_base", anchor);
                break;
            }
            else if (err.holochainMessage == "No links for " + tag) // no entries with that tag- yay! BREAK OUT OF THE LOOP!
                break;
            else {
                throw err; // other error, return it
            }

        }

    }

    // add the new value's link
    var linkHash = commit("anchor_link", { Links: [{ Base: anchorHash, Link: valueHash, Tag: tag }] });

    return { anchorHash: anchorHash, valueHash: valueHash, linkHash: linkHash };

}

function getListItems(parms) {

    var anchor = parms === undefined ? undefined : parms.anchor;
    var anchorHash = parms === undefined ? undefined : parms.anchorHash;
    var withLinkHash = parm === undefined ? undefined : parms.withLinkHash === undefined ? false : parms.withLinkHash;

    if (anchorHash == undefined) {
        if (anchor == undefined)
            throw new errorObject("Must pass either anchor or anchorHash!");

        anchorHash = makeHash("anchor_base", anchor);
    }
    else if (anchor != undefined)
        throw new errorObject("Can't pass both anchor and anchorHash!");

    // get all links on that base
    try { var links = getLinks(anchorHash, "", { Load: true }); }

    catch (err)// failed
    {
        if (err.holochainMessage == "hash not found")
            return null;
        else if (err.holochainMessage == ("No links for " + ANCHOR_GENERIC)) // no entries!
            return [];
        else
            throw err;
    }

    var rtn = [];

    for (var x = 0; x < links.length; x++)
        rtn.push(links[x].Entry);

    return rtn;

}

// returns number of items removed
function removeFromList(parms) {

    var anchor = parms === undefined ? undefined : parms.anchor;
    var anchorHash = parms === undefined ? undefined : parms.anchorHash;
    var value = parms === undefined ? undefined : parms.value;
    var valueHash = parms === undefined ? undefined : parms.valueHash;
    var entryType = parms === undefined ? undefined : parms.entryType == undefined ? ANCHOR_GENERIC : parms.entryType;
    var preserveOldValueEntry = parms === undefined ? undefined : parms.preserveOldValueEntry == undefined ? false : parms.preserveOldValueEntry;

    if (anchorHash === undefined) // didn't get an anchorHash
    {
        if (anchor === undefined)
            throw new errorObject("Must pass either anchor or anchorHash!");

        anchorHash = makeHash("anchor_base", anchor);
    }
    else if (anchor !== undefined) // got an anchor hash and an anchor
        throw new errorObject("Can't pass both anchor and anchorHash!");

    if (valueHash === undefined) {
        if (value === undefined) 
            throw new errorObject("Must pass either value or valueHash!");

        valueHash = makeHash(entryType, value);
    }
    else if (value !== undefined)
        throw new errorObject("Can't pass both value and valueHash!");

    // get the links on that base
    try { var links = getLinks(anchorHash, "", { Load: true }); }

    catch (err) // failed
    {
        if (err.holochainMessage == "hash not found")
            throw new errorObject("Anchor does not exist!");
        else if (err.holochainMessage == "No links for ") // no links on that base!
            return 0;
        else
            throw err;
    }

    var count = 0;

    for (var x = 0; x < links.length; x++) {

        var et = links[x].Tag.split(ANCHOR_DELIMETER)[0];
        if (links[x].Hash == valueHash && entryType == et) {
            
            commit("anchor_link", { Links: [{ Base: anchorHash, Link: links[x].Hash, Tag: links[x].Tag, LinkAction: HC.LinkAction.Del }] })
    
            // if (!preserveOldValueEntry && count == 0)
            //     remove(links[x].Hash, "anchors:removeFromList");

            count++;
        }
    }

    return count;

}

function initializeAnchor(parms)
{
    return commit("anchor_base", parms.anchor);
}

function makeRandomString(length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  
    for (var i = 0; i < length; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length));
  
    return text;
}

// a version of makeHash that uses anchorGeneric when no entryType is specified
function makeAnchorValueHash(parms)
{
    return makeHash(parms.entryType === undefined ? ANCHOR_GENERIC : parms.entryType, parms.value);
}

function isObject(item)
{
    return item === Object(item);
}

var testLinksListBase = "";
var testLinksListResults = [];

function testLinksList()
{
    testLinksListBase = commit("anchor_base", "testLinksList");

    testLinksListResults.push(testLinksListGetCount());
    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_generic_", "value1"), Tag: "tag1" }] });
    testLinksListResults.push(testLinksListGetCount());
    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_generic_", "value2"), Tag: "tag1" }] });
    testLinksListResults.push(testLinksListGetCount());
    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_generic_", "value1"), Tag: "tag2" }] });
    testLinksListResults.push(testLinksListGetCount());
    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_generic_", "value2"), Tag: "tag2" }] });
    testLinksListResults.push(testLinksListGetCount());
    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_json_type_for_testing_", "value1"), Tag: "tag1" }] });
    testLinksListResults.push(testLinksListGetCount());
    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_json_type_for_testing_", "value2"), Tag: "tag1" }] });
    testLinksListResults.push(testLinksListGetCount());
    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_json_type_for_testing_", "value1"), Tag: "tag2" }] });
    testLinksListResults.push(testLinksListGetCount());
    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_json_type_for_testing_", "value2"), Tag: "tag2" }] });
    testLinksListResults.push(testLinksListGetCount());
    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_string_type_for_testing_", "value1"), Tag: "tag1" }] });
    testLinksListResults.push(testLinksListGetCount());
    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_string_type_for_testing_", "value2"), Tag: "tag1" }] });
    testLinksListResults.push(testLinksListGetCount());
    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_string_type_for_testing_", "value1"), Tag: "tag2" }] });
    testLinksListResults.push(testLinksListGetCount());
    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_string_type_for_testing_", "value2"), Tag: "tag2" }] });
    testLinksListResults.push(testLinksListGetCount());
    
    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_generic_", "value1"), Tag: "tag1", LinkAction: HC.LinkAction.Del }] });
    testLinksListResults.push(testLinksListGetCount());
    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_generic_", "value2"), Tag: "tag1", LinkAction: HC.LinkAction.Del }] });
    testLinksListResults.push(testLinksListGetCount());
    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_generic_", "value1"), Tag: "tag2", LinkAction: HC.LinkAction.Del }] });
    testLinksListResults.push(testLinksListGetCount());
    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_generic_", "value2"), Tag: "tag2", LinkAction: HC.LinkAction.Del }] });
    testLinksListResults.push(testLinksListGetCount());
    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_json_type_for_testing_", "value1"), Tag: "tag1", LinkAction: HC.LinkAction.Del }] });
    testLinksListResults.push(testLinksListGetCount());
    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_json_type_for_testing_", "value2"), Tag: "tag1", LinkAction: HC.LinkAction.Del }] });
    testLinksListResults.push(testLinksListGetCount());
    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_json_type_for_testing_", "value1"), Tag: "tag2", LinkAction: HC.LinkAction.Del }] });
    testLinksListResults.push(testLinksListGetCount());
    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_json_type_for_testing_", "value2"), Tag: "tag2", LinkAction: HC.LinkAction.Del }] });
    testLinksListResults.push(testLinksListGetCount());
    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_string_type_for_testing_", "value1"), Tag: "tag1", LinkAction: HC.LinkAction.Del }] });
    testLinksListResults.push(testLinksListGetCount());
    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_string_type_for_testing_", "value2"), Tag: "tag1", LinkAction: HC.LinkAction.Del }] });
    testLinksListResults.push(testLinksListGetCount());
    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_string_type_for_testing_", "value1"), Tag: "tag2", LinkAction: HC.LinkAction.Del }] });
    testLinksListResults.push(testLinksListGetCount());
    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_string_type_for_testing_", "value2"), Tag: "tag2", LinkAction: HC.LinkAction.Del }] });
    testLinksListResults.push(testLinksListGetCount());

    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_generic_", "value1"), Tag: "tag1" }] });
    testLinksListResults.push(testLinksListGetCount());
    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_generic_", "value1"), Tag: "tag1" }] });
    testLinksListResults.push(testLinksListGetCount());

    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_generic_", "value3"), Tag: "tag1" }] });
    testLinksListResults.push(testLinksListGetCount());
    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_generic_", "value3"), Tag: "tag1" }] });
    testLinksListResults.push(testLinksListGetCount());

    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_generic_", "value3"), Tag: "tag1", LinkAction: HC.LinkAction.Del }] });
    testLinksListResults.push(testLinksListGetCount());
    commit("anchor_link", { Links: [{ Base: testLinksListBase, Link: commit("_anchor_generic_", "value1"), Tag: "tag1", LinkAction: HC.LinkAction.Del }] });
    testLinksListResults.push(testLinksListGetCount());

    return testLinksListResults;

}

function testAnchors()
{
    testLinksListBase = commit("anchor_base", "testLinksList");

    testLinksListResults.push(testLinksListGetCount());
    addToList({ anchorHash: testLinksListBase, entryType: "_anchor_generic_", value: commit("_anchor_generic_", "value1") });
    testLinksListResults.push(testLinksListGetCount());
    addToList({ anchorHash: testLinksListBase, entryType: "_anchor_generic_", value: commit("_anchor_generic_", "value2") });
    testLinksListResults.push(testLinksListGetCount());
    addToList({ anchorHash: testLinksListBase, entryType: "_anchor_generic_", value: commit("_anchor_generic_", "value3") });
    testLinksListResults.push(testLinksListGetCount());
    addToList({ anchorHash: testLinksListBase, entryType: "_anchor_generic_", value: commit("_anchor_generic_", "value4") });
    testLinksListResults.push(testLinksListGetCount());
    addToList({ anchorHash: testLinksListBase, entryType: "_anchor_json_type_for_testing_", value: commit("_anchor_json_type_for_testing_", "value1") });
    testLinksListResults.push(testLinksListGetCount());
    addToList({ anchorHash: testLinksListBase, entryType: "_anchor_json_type_for_testing_", value: commit("_anchor_json_type_for_testing_", "value2") });
    testLinksListResults.push(testLinksListGetCount());
    addToList({ anchorHash: testLinksListBase, entryType: "_anchor_json_type_for_testing_", value: commit("_anchor_json_type_for_testing_", "value3") });
    testLinksListResults.push(testLinksListGetCount());
    addToList({ anchorHash: testLinksListBase, entryType: "_anchor_json_type_for_testing_", value: commit("_anchor_json_type_for_testing_", "value4") });
    testLinksListResults.push(testLinksListGetCount());

    removeFromList({ anchorHash: testLinksListBase, entryType: "_anchor_generic_", value: commit("_anchor_generic_", "value1") });
    testLinksListResults.push(testLinksListGetCount());
    removeFromList({ anchorHash: testLinksListBase, entryType: "_anchor_generic_", value: commit("_anchor_generic_", "value2") });
    testLinksListResults.push(testLinksListGetCount());
    removeFromList({ anchorHash: testLinksListBase, entryType: "_anchor_generic_", value: commit("_anchor_generic_", "value3") });
    testLinksListResults.push(testLinksListGetCount());
    removeFromList({ anchorHash: testLinksListBase, entryType: "_anchor_generic_", value: commit("_anchor_generic_", "value4") });
    testLinksListResults.push(testLinksListGetCount());
    removeFromList({ anchorHash: testLinksListBase, entryType: "_anchor_json_type_for_testing_", value: commit("_anchor_json_type_for_testing_", "value1") });
    testLinksListResults.push(testLinksListGetCount());
    removeFromList({ anchorHash: testLinksListBase, entryType: "_anchor_json_type_for_testing_", value: commit("_anchor_json_type_for_testing_", "value2") });
    testLinksListResults.push(testLinksListGetCount());
    removeFromList({ anchorHash: testLinksListBase, entryType: "_anchor_json_type_for_testing_", value: commit("_anchor_json_type_for_testing_", "value3") });
    testLinksListResults.push(testLinksListGetCount());
    removeFromList({ anchorHash: testLinksListBase, entryType: "_anchor_json_type_for_testing_", value: commit("_anchor_json_type_for_testing_", "value4") });
    testLinksListResults.push(testLinksListGetCount());

    addToList({ anchorHash: testLinksListBase, entryType: "_anchor_generic_", value: commit("_anchor_generic_", "value1") });
    testLinksListResults.push(testLinksListGetCount());
    addToList({ anchorHash: testLinksListBase, entryType: "_anchor_generic_", value: commit("_anchor_generic_", "value1") });
    testLinksListResults.push(testLinksListGetCount());
    addToList({ anchorHash: testLinksListBase, entryType: "_anchor_generic_", value: commit("_anchor_generic_", "value1") });
    testLinksListResults.push(testLinksListGetCount());
    addToList({ anchorHash: testLinksListBase, entryType: "_anchor_generic_", value: commit("_anchor_generic_", "value1") });
    testLinksListResults.push(testLinksListGetCount());
    addToList({ anchorHash: testLinksListBase, entryType: "_anchor_json_type_for_testing_", value: commit("_anchor_json_type_for_testing_", "value1") });
    testLinksListResults.push(testLinksListGetCount());
    addToList({ anchorHash: testLinksListBase, entryType: "_anchor_json_type_for_testing_", value: commit("_anchor_json_type_for_testing_", "value1") });
    testLinksListResults.push(testLinksListGetCount());
    addToList({ anchorHash: testLinksListBase, entryType: "_anchor_json_type_for_testing_", value: commit("_anchor_json_type_for_testing_", "value1") });
    testLinksListResults.push(testLinksListGetCount());
    addToList({ anchorHash: testLinksListBase, entryType: "_anchor_json_type_for_testing_", value: commit("_anchor_json_type_for_testing_", "value1") });
    testLinksListResults.push(testLinksListGetCount());

    removeFromList({ anchorHash: testLinksListBase, entryType: "_anchor_generic_", value: commit("_anchor_generic_", "value1") });
    testLinksListResults.push(testLinksListGetCount());
    removeFromList({ anchorHash: testLinksListBase, entryType: "_anchor_json_type_for_testing_", value: commit("_anchor_json_type_for_testing_", "value1") });
    testLinksListResults.push(testLinksListGetCount());

    return testLinksListResults;
}

function testLinksListGetCount()
{
    var rtn = 0;

    var links;
    
    try { 
        links = getLinks(testLinksListBase, "", {});
        rtn = links.length; 

        // for(var x = 0; x < rtn; x++)
        //     debug(links[x].Hash + " - " + links[x].Tag);
    }
    catch (err) {}

    // debug("");

    return rtn;
}

function errorObject(errorText) {
    this.name = "AnchorsError";
    this.message = errorText;
    this.toString = function () { return this.message; };
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


