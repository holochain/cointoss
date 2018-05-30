var Me = null;
var Handle = null;
var Handles = {};
var Users = {};
var ActivePlayer = null;

function getHandle(who, callbackFn) {
    send("getHandle", who, function (handle) {
        if (callbackFn != undefined) {
            callbackFn(handle);
        }
    });
}


function getHandles(callbackFn) {
    send("getHandles", undefined, function (json) {
        Handles = JSON.parse(json);
        updatePlayers();
        if (callbackFn != undefined) {
            callbackFn(handles);
        }
    });
}

function makePlayerHTML(handle_object) {
    return "<li data-id=\"" + handle_object.handleHash + "\"" +
        "data-name=\"" + handle_object.handle + "\">" +
        handle_object.handle +
        "</li>";
}

function updatePlayers() {
    $("#players").empty();
    for (var x = 0; x < Handles.length; x++) {
        if(Handles[x].handle === Handle)
        {
             Handles[x].handle = Handles[x].handle + " (myself)";
        }
        $("#players").append(makePlayerHTML(Handles[x]));
    }
    if (ActivePlayer) {
        setActivePlayer();
    }
}

function getMyHandle(callbackFn) {
    getHandle(Me, function (handle) {
        if(handle === "")
        {
            handle = "Click me!";
        }
        Handle = handle;
        $("#handle").html(handle);
        if (callbackFn != undefined) {
            callbackFn();
        }
    });
}

function getProfile() {
    send("whoAmI", undefined, function (me) {
        Me = me;
        getMyHandle();
    });
}

function getUserHandle(user) {
    var author = Handles[user];
    var handle;
    if (author == undefined) {
        handle = user;
    } else {
        handle = author.handle;
    }
    return handle;
}

function doSetHandle() {
    var handle = $("#myHandle").val();

    send("setHandle", handle, function (data) {
        if (data != "") {
            getMyHandle();
        }
        $('#setHandleDialog').modal('hide');
    });
}

function openSetHandle() {
    $('#setHandleDialog').modal('show');
}

function selectPlayer(event) {
    $("#players li").removeClass("selected-player");
    ActivePlayer = $(this).data('id');
    setActivePlayer();
}

function setActivePlayer() {
    var elem = $("#players li[data-id=" + ActivePlayer + "]");
    $(elem).addClass("selected-player");
    $("#tosses-header").text("Tosses with " + $(elem).data("name"));
    loadHistory();
}

function loadHistory() {
    send("getTossHistory", JSON.stringify({ "responder": ActivePlayer }), function (json) {
        toss_history = JSON.parse(json);

        $("#tosses").html("");

        for (var x = 0; x < toss_history.length; x++)
            $("#tosses").append("<li>" + new Date(toss_history[x].timeStamp).toString("MM/dd/yyyy HH:mm:ss") + ": " + toss_history[x].htmlDescription + "</li>");

    });
}

function confirmToss(toss) {
    // TODO add toss caching
    send("confirmToss", toss, function (result) {
        alert(result);
    });
}

function requestToss() {
    if (!ActivePlayer) {
        alert("pick a player first!");
    }
    else {
        send("requestToss", JSON.stringify({ "agent": ActivePlayer }), function (result) {
            result = JSON.parse(result);
            confirmToss(result.toss);
        });
    }
}

$(window).ready(function () {
    $("#handle").on("click", "", openSetHandle);
    $('#setHandleButton').click(doSetHandle);
    $("#players").on("click", "li", selectPlayer);
    $("#req-toss-button").click(requestToss);
    getProfile();
    setInterval(getHandles, 2000);
});
