(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.BoldEventStream = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
//let EventModels = require('./eventModels_ES6');

let successResponse = { json: function () { return { 'type': 'custom', 'status': 'success' } } };

let ajaxCreateClientObject = function (boldEventStreamConfiguration) {
    if (boldEventStreamConfiguration.Commons.enableConsoleLogging)
        console.log("Client Creation Process Started For Ajax.");

    let ajaxClient = {
        boldEventStreamConfiguration: boldEventStreamConfiguration,
        eventsToSendBuffer: [],
        syncIntervalObject: -1,
        //functions
        ajaxCreateConnectionAndSendEvents: ajaxCreateConnectionAndSendEvents
    }

    if (boldEventStreamConfiguration.AjaxDetails.eventsSyncTimeInMillis > 0) {
        ajaxClient.syncIntervalObject = setInterval(function () {
            if (ajaxClient.eventsToSendBuffer != null && ajaxClient.eventsToSendBuffer.length > 0) {

                if (ajaxClient.boldEventStreamConfiguration.Commons.enableConsoleLogging)
                    console.log("Time Interval Reached.");

                // Intervall calls it , but we can return something anyway.
                return ajaxClient.ajaxCreateConnectionAndSendEvents(ajaxClient);
            }
        }, boldEventStreamConfiguration.AjaxDetails.eventsSyncTimeInMillis);
    }
    if (boldEventStreamConfiguration.Commons.enableConsoleLogging)
        console.log("Client Creation Process Successfull For Ajax.");
    return Promise.resolve(ajaxClient);
}

let ajaxSendEventToServer = function (ajaxClient, singleEvent, sendEventProperties) {

    return new Promise(function (resolve, reject) {
        // if immediate send or buffer is full or is forcePush
        if (sendEventProperties.forcePush || ajaxClient.boldEventStreamConfiguration.AjaxDetails.eventsSyncTimeInMillis == 0
            || ajaxClient.eventsToSendBuffer.length + 1 >= ajaxClient.boldEventStreamConfiguration.AjaxDetails.eventsBufferSize) {

            if (ajaxClient.boldEventStreamConfiguration.Commons.enableConsoleLogging)
                console.log("Event Added To Queue And Send Started.");

            ajaxClient.eventsToSendBuffer.push(singleEvent);
            ajaxCreateConnectionAndSendEvents(ajaxClient)
                .then(function () { resolve(); })
                .catch(function (err) { reject(err); });
        }
        else {
            if (ajaxClient.boldEventStreamConfiguration.Commons.enableConsoleLogging)
                console.log("Event Added To Queue.");
            ajaxClient.eventsToSendBuffer.push(singleEvent);
            resolve();
        }
    });// main promise
}

let ajaxSendEventToServerInBulk = function (ajaxClient, eventArray, sendBulkEventProperties) {

    // if (ajaxClient.boldEventStreamConfiguration.Commons.enableConsoleLogging)
    //     console.log("Ajax Bulk Send Started.");

    // if (eventArray.length == 1)
    //     return sendOrStackEvent(ajaxClient, eventArray[0], sendBulkEventProperties);
    // else {
    //     for (let index = 0; index < eventArray.length; index++) {
    //         if (index == eventArray.length - 1) { // last entry
    //             return ajaxSendEventToServer(ajaxClient, eventArray[index], forcePush);
    //         }
    //         else {
    //             ajaxClient.eventsToSendBuffer.push(eventArray[index]);
    //         }
    //     }
    // }
}

let ajaxCreateConnectionAndSendEvents = function (ajaxClient) {
    return new Promise(function (resolve, reject) {
        // may never come here. 
        if (ajaxClient.eventsToSendBuffer == null || ajaxClient.eventsToSendBuffer.length == 0)
            resolve(successResponse);

        if (ajaxClient.boldEventStreamConfiguration.Commons.enableConsoleLogging)
            console.log("Ajax to server - Started ");

        let eventsToSend = ajaxClient.eventsToSendBuffer;
        ajaxClient.eventsToSendBuffer = [];
        fetch(ajaxClient.boldEventStreamConfiguration.AjaxDetails.eventsPostEndpointUrl, {
            method: 'POST', // *GET, POST, PUT, DELETE, etc.
            //mode: 'cors', // no-cors, *cors, same-origin
            //cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
            //credentials: 'same-origin', // include, *same-origin, omit
            headers: { "Content-Type": "application/json" },
            //redirect: 'follow', // manual, *follow, error
            //referrer: 'no-referrer', // no-referrer, *client
            body: JSON.stringify(eventsToSend)
        })
            .then(function (response) {
                if (ajaxClient.boldEventStreamConfiguration.Commons.enableConsoleLogging)
                    console.log("Ajax to server - Completed. Resp Code - " + response.status);
                if (response.ok)
                    resolve(response);
                else {
                    if (ajaxClient.boldEventStreamConfiguration.Commons.enableConsoleLogging)
                        console.log("Ajax to server - Failed.");
                    ajaxClient.eventsToSendBuffer = eventsToSend.concat(ajaxClient.eventsToSendBuffer);
                    reject(new Error('Error in Ajax Call with status -  ' + response.status));
                }
                //if anyone wants to read data they need to call json seperately.
                //response.json().then(function (data) { resolve(data); })
            })
            .catch(function (error) {
                if (ajaxClient.boldEventStreamConfiguration.Commons.enableConsoleLogging)
                    console.log("Ajax to server - Failed.");
                ajaxClient.eventsToSendBuffer = eventsToSend.concat(ajaxClient.eventsToSendBuffer);
                reject(error);
            });

    });// main promise end
}

module.exports = {
    ajaxCreateClientObject: ajaxCreateClientObject,
    ajaxSendEventToServer: ajaxSendEventToServer,
    ajaxSendEventToServerInBulk: ajaxSendEventToServerInBulk
}
},{}],2:[function(require,module,exports){
//let EventModels = require('./eventModels_ES6');

let mqttCreateClientObjectAndConnect = function (globalObject, boldEventStreamConfiguration) {
    return new Promise(function (resolve, reject) {
        let mqttClientToUse = {
            boldEventStreamConfiguration: boldEventStreamConfiguration,
            pahoClient: null,
            pahoClientId: '',
            //subscriberArray: [{ topicName: null, callBack: null }]//
        };

        if (boldEventStreamConfiguration.Commons.enableConsoleLogging)
            console.log("Client Creation Process Started For Mqtt.");

        mqttClientToUse.pahoClientId = boldEventStreamConfiguration.MqttDetails.clientIdPrefix + parseInt(Math.random() * 100);

        mqttClientToUse.pahoClient = new globalObject.Paho.MQTT.Client(boldEventStreamConfiguration.MqttDetails.mqttHost,
            boldEventStreamConfiguration.MqttDetails.mqttPort, mqttClientToUse.pahoClientId);

        mqttOpenConnection(mqttClientToUse)
            .then(function () {
                if (boldEventStreamConfiguration.Commons.enableConsoleLogging)
                    console.log("Client Creation Process Successfull For Mqtt.");
                resolve(mqttClientToUse);
            })
            .catch(function (err) {
                if (boldEventStreamConfiguration.Commons.enableConsoleLogging)
                    console.log("Client Creation Process Failed For Mqtt.");
                reject(err);
            });
    });//main promise
}

let mqttSendEventToServer = function (globalObject, mqttClientToUse, eventObject, sendEventProperties) {
    return new Promise(function (resolve, reject) {
        Promise.resolve()
            .then(function () {
                if (!mqttClientToUse.pahoClient.isConnected()) {
                    let openConn = mqttOpenConnection();
                    openConn.then(function () {
                        //re connect to all subscribers if needed.
                    })
                    return openConn;
                }
                //this line not neeed and added by default
                //else return Promise.resolve(); 
            })
            .then(function () {
                let topicToBeUsed = sendEventProperties.overrideTopicToBeUsed || eventObject.EventType
                    || mqttClientToUse.boldEventStreamConfiguration.MqttDetails.defaultTopicToSend;
                if (mqttClientToUse.boldEventStreamConfiguration.Commons.enableConsoleLogging)
                    console.log("Sending Message To Topic- " + topicToBeUsed);                
                let eventStr = JSON.stringify(eventObject);
                let mqMessage = new globalObject.Paho.MQTT.Message(eventStr);
                mqMessage.destinationName = topicToBeUsed;
                mqttClientToUse.pahoClient.send(mqMessage);
                if (mqttClientToUse.boldEventStreamConfiguration.Commons.enableConsoleLogging)
                    console.log("Message Sent To Topic- " + topicToBeUsed);
            })
            .then(function () {
                resolve();
            })
            .catch(function (err) { reject(err); });
    });// main promise
};

let mqttSendEventToServerInBulk = function (mqttClientToUse, eventsArray, sendBulkEventProperties) {
    return new Promise(function (resolve, reject) {
        if (eventsArray != null && !Array.isArray(eventsArray)) {
            throw new Error("Event Array Not Initialized Properly.");
        }
        let promArr = [];
        for (let index = 0; index < eventsArray.length; index++) {
            promArr.push(mqttSendEventToServer(mqttClientToUse, eventsArray[index]), sendBulkEventProperties);
        }
        Promise.all(promArr)
            .then(function () { resolve(); })
            .catch(function (err) { reject(err); });
    });//main promise
};


let mqttSubscribeToTopic = function (mqttClientToUse, subscribeToTopicProperties) {
    return new Promise(function (resolve, reject) {
        mqttClientToUse.pahoClient.onMessageArrived = function (m) { mqttOnMessageReceived(mqttClientToUse, m, subscribeToTopicProperties.callBackFunction); };
        mqttClientToUse.pahoClient.subscribe(subscribeToTopicProperties.topicToSubscribe);
        if (mqttClientToUse.boldEventStreamConfiguration.Commons.enableConsoleLogging)
            console.log("Subscribed to Topic- " + subscribeToTopicProperties.topicToSubscribe);
        resolve();
    });//main promise
}

let mqttOnMessageReceived = function (mqttClientToUse, message, clientCallBack) {
    if (mqttClientToUse.boldEventStreamConfiguration.Commons.enableConsoleLogging)
        console.log("New Message Received on Topic - " + message.destinationName);

    if (clientCallBack && typeof (clientCallBack) == "function")
        clientCallBack(message);
}


//Mqtt Private Functions
let mqttOpenConnection = function (mqttClientToUse) {
    return new Promise(function (resolve, reject) {
        try {
            if (mqttClientToUse.boldEventStreamConfiguration.Commons.enableConsoleLogging)
                console.log("Connecting to " + mqttClientToUse.boldEventStreamConfiguration.MqttDetails.mqttHost + ":" + mqttClientToUse.boldEventStreamConfiguration.MqttDetails.mqttPort + " ClientId- " + mqttClientToUse.pahoClientId);

            let options = {
                onSuccess: function () { mqttOnConnectSuccess(mqttClientToUse, resolve); },
                onFailure: function (resp) { mqttOnConnectFail(mqttClientToUse, new Error(resp.errorMessage), reject); },
                userName: mqttClientToUse.boldEventStreamConfiguration.MqttDetails.mqttUserName,
                password: mqttClientToUse.boldEventStreamConfiguration.MqttDetails.mqttPassword,
                useSSL: mqttClientToUse.boldEventStreamConfiguration.MqttDetails.mqttIsSecureConnection
                /*timeout: "number",
                willMessage: "object",
                keepAliveInterval: "number",
                cleanSession: "boolean",                    
                invocationContext: "object",
                hosts: "object",
                ports: "object",
                mqttVersion: "number"*/
            };
            //connect to mqtt.
            mqttClientToUse.pahoClient.connect(options);
        }
        catch (ex) {
            let err = null;
            if (ex instanceof Error) {
                err = ex;
            }
            else if (!!ex && ex instanceof Object && !!ex.errorMessage) {
                err = new Error(ex.errorMessage);
            }
            else {
                err = new Error('Error occoured while connecting to server - ' + ex);
            }
            mqttOnConnectFail(mqttClientToUse, err, reject);
        }
    });
}
let mqttOnConnectSuccess = function (mqttClientToUse, resolveFunc) {
    if (mqttClientToUse.boldEventStreamConfiguration.Commons.enableConsoleLogging)
        console.log("Connection to " + mqttClientToUse.boldEventStreamConfiguration.MqttDetails.mqttHost + ":" + mqttClientToUse.boldEventStreamConfiguration.MqttDetails.mqttPort + " is Successful.");

    if (mqttClientToUse.boldEventStreamConfiguration.MqttDetails.onConnectSuccessCallback && typeof (mqttClientToUse.boldEventStreamConfiguration.MqttDetails.onConnectSuccessCallback) == "function")
        mqttClientToUse.boldEventStreamConfiguration.MqttDetails.onConnectSuccessCallback();
    resolveFunc();
}
let mqttOnConnectFail = function (mqttClientToUse, err, rejectFunc) {
    if (mqttClientToUse.boldEventStreamConfiguration.Commons.enableConsoleLogging)
        console.log("Connection to " + mqttClientToUse.boldEventStreamConfiguration.MqttDetails.mqttHost + ":" + mqttClientToUse.boldEventStreamConfiguration.MqttDetails.mqttPort + " failed, with message - '" + err.message + "'");
    if (mqttClientToUse.boldEventStreamConfiguration.MqttDetails.onConnectFailCallback && typeof (mqttClientToUse.boldEventStreamConfiguration.MqttDetails.onConnectFailCallback) == "function")
        mqttClientToUse.boldEventStreamConfiguration.MqttDetails.onConnectFailCallback(err);

    //reject the promise
    rejectFunc(err);
}
let mqttCloseConnection = function (mqttClientToUse) {
    // try {
    //     mqttClientToUse.pahoClient.disconnect();

    //     if (mqttClientToUse.boldEventStreamConfiguration.Commons.enableConsoleLogging)
    //         console.log("Disconnected Connection to - " + mqttClientToUse.boldEventStreamConfiguration.MqttDetails.mqttHost + ":" + mqttClientToUse.boldEventStreamConfiguration.MqttDetails.mqttPort + " ClientId- " + mqttClientToUse.pahoClientId);
    // } catch (ex) {
    //     console.log("%c  Error Occured While Execuing 'mqttCloseConnection'. Error is -  " + ex.message, "background: Yellow;color:Red");
    //     if (mqttClientToUse.boldEventStreamConfiguration.Commons.enableErrorThrown)
    //         throw ex;
    // }
}


module.exports = {
    mqttCreateClientObjectAndConnect: mqttCreateClientObjectAndConnect,
    mqttSendEventToServer: mqttSendEventToServer,
    mqttSendEventToServerInBulk: mqttSendEventToServerInBulk,
    mqttSubscribeToTopic: mqttSubscribeToTopic,
    //mqttUnSubscribeToTopic: mqttUnSubscribeToTopic,
    //mqttReconnectWithSameOptions: mqttReconnectWithSameOptions,
    //mqttEndClient: mqttEndClient
}
},{}],3:[function(require,module,exports){
//Classes Structure Starts

const SendClientToUse = {
    Default: 'de',
    Mqtt: 'mq',
    Ajax: 'aj',
    All: 'all' 
}

class SendEventProperties {
    constructor() {
        this.sendClientToUse = SendClientToUse.Default;
        this.forcePush = false;
        this.overrideTopicToBeUsed = "";
        this.qos = 0
    }
}

class SendBulkEventProperties extends SendEventProperties {
    constructor() {

    }
}

class SubscribeToTopicProperties {
    constructor() {
        this.topicToSubscribe = "";
        this.callBackFunction = null;
    }
}



class BoldEventStreamConfiguration {
    constructor() {

        this.AjaxDetails = {
            eventsPostEndpointUrl: "/api/EventsStream",
            eventsSyncTimeInMillis: 10000,
            eventsBufferSize: 10
        };
        this.MqttDetails = {
            pahoMqttUrl: "https://cdnjs.cloudflare.com/ajax/libs/paho-mqtt/1.0.1/mqttws31.min.js",
            clientIdPrefix: "jsClientID-",
            mqttHost: "",
            mqttPort: 0,
            mqttUserName: "",
            mqttPassword: "",
            mqttIsSecureConnection: true,
            onConnectFailCallback: null,
            onConnectSuccessCallback: null,
            defaultTopicToSend: "DefaultBoldClientEvents",

            connectionRetryConnectTime: 2000,
            connectionRetryCount: 2,
        };
        this.Commons = {
            defaultClientToInitialize: SendClientToUse.Mqtt,
            defaultClientToUse: SendClientToUse.Mqtt,
            enableConsoleLogging: false,
            enableErrorThrown: false
        };
    }
}

const EventSubTypes = {
    AutoComplete: {
        TTCSearched: "TTCSearched",
        TTCClicked: "TTCClicked",
        JobTitleSearched: "JobTitleSearched",
        JobTitleClicked: "JobTitleClicked",
        toString() { return "AutoComplete"; }
    },
    Dictionary: {
        SpellCheck: "SpellCheck"
    },
    Custom: {
        EnterBuilder: "EnterBuilder",
        DocDownloaded: "DocDownloaded",
        toString() { return "Custom"; }
    },
    Page: {
        PageDetail: "PageDetail",
        toString() { return "Page"; }
    },
    Widget: {
        Job: "Job",
        RR: "RR",
        toString() { return "Widget"; }
    },
    Component: {
        Builder: "Builder",
        toString() { return "Component"; }
    }
};
class BaseBoldEvent {
    constructor(eventType, eventSubType) {
        this.EventType = eventType;
        this.EventSubType = eventSubType;
        this.CreatedOnUtc = new Date().toISOString();
        this.MessageSendTimeUtc = "added automatically by package";

        this.ExperimentID = "";
        this.VariantID = "";
        this.WidgetCD = "";
        this.UserUID = "";
        this.SourceAppUID = "";
        this.VisitorUID = "";
        this.VisitUID = "";
        this.ZoneCD = "";
        this.PortalCD = "";
        this.ProductCD = "";
        this.Locale = "";
        this.Page = "";
    }
}

class BoldDictionaryEvent extends BaseBoldEvent {
    constructor(eventSubType) {
        super("Dictionary", eventSubType);
        this.PayloadSize = 0;
        this.SectionTypeCD = "";
        this.Separator = ""; 
    }
}

class BoldAutoCompleteEvent extends BaseBoldEvent {
    constructor(eventSubType) {
        super("AutoComplete", eventSubType);
        this.SearchTerm = "";
        this.SuggestionPosition = 0;
    }
}
class BoldCustomEvent extends BaseBoldEvent {
    constructor(eventSubType) {
        super("Custom", eventSubType);
        this.CustProp1 = "";
        this.CustProp2 = 0;
    }
}
class BoldPageEvent extends BaseBoldEvent {
    constructor(eventSubType) {
        super("Page", eventSubType);
        this.PageProp1 = "";
        this.PageProp2 = 0;
    }
}
class BoldWidgetEvent extends BaseBoldEvent {
    constructor(eventSubType) {
        super("Widget", eventSubType);
        this.WidgetProp1 = "";
        this.WidgetProp2 = 0;
    }
}
class BoldComponentEvent extends BaseBoldEvent {
    constructor(eventSubType) {
        super("Component", eventSubType);
        this.ComponentProp1 = "";
        this.ComponentProp2 = 0;
    }
}

//Classes Structure Ends


let getNewConfigurationObject = function () {
    let retObj = new BoldEventStreamConfiguration();
    Object.seal(retObj);
    return retObj;
}

// getNewConfigurationObjectWithInitialValues = function (initialValues = null) {
//     if (initialValues == null)
//         return getNewConfigurationObject();
//     if (eventObject instanceof BoldEventStreamConfiguration)
//         throw new Error("initialValues  not instance of 'BoldEventStreamConfiguration' use Enums.getNewConfigurationObject()");

//     //Merge Objects
//     for (let attrname in initialValues) {
//         _boldEventStreamConfiguration[attrname] = initialValues[attrname];
//     }
//     retryCountForMqttConnection = initialValues.connectionRetryCount;
// }

function getNewBoldEventObject(eventSubTypesVal) {
    if (typeof eventSubTypesVal != 'string')
        throw new Error("passed parameter 'EventSubTypes' to function 'getNewBoldEventObject'  is not a string. ");
    let retObject = null;
    switch (eventSubTypesVal) {

        case EventSubTypes.Custom.EnterBuilder:
            retObject = new BoldCustomEvent(eventSubTypesVal);
            break;
        case EventSubTypes.Custom.DocDownloaded:
            retObject = new BoldCustomEvent(eventSubTypesVal);
            break;
        case EventSubTypes.AutoComplete.TTCSearched:
            retObject = new BoldAutoCompleteEvent(eventSubTypesVal);
            break;
        case EventSubTypes.AutoComplete.TTCClicked:
            retObject = new BoldAutoCompleteEvent(eventSubTypesVal);
            break;
        case EventSubTypes.AutoComplete.JobTitleSearched:
            retObject = new BoldAutoCompleteEvent(eventSubTypesVal);
            break;
        case EventSubTypes.AutoComplete.JobTitleClicked:
            retObject = new BoldAutoCompleteEvent(eventSubTypesVal);
            break;
        case EventSubTypes.Page.PageDetail:
            retObject = new BoldPageEvent(eventSubTypesVal);
            break;
        case EventSubTypes.Widget.Job:
            retObject = new BoldWidgetEvent(eventSubTypesVal);
            break;
        case EventSubTypes.Widget.RR:
            retObject = new BoldWidgetEvent(eventSubTypesVal);
            break;
        case EventSubTypes.Component.Builder:
            retObject = new BoldComponentEvent(eventSubTypesVal);
            break;
        case EventSubTypes.Dictionary.SpellCheck:
            retObject = new BoldDictionaryEvent(eventSubTypesVal);
            break;
        default:
            throw new Error("EventType Not Sent Properly, Please use 'BoldEventStream.ClassInitializers.EventSubTypes' to set.")
    }
    Object.seal(retObject);
    return retObject;
}

module.exports = {
    Enums: {
        EventSubTypes: EventSubTypes,
        SendClientToUse: SendClientToUse,
    },
    SubscribeToTopicProperties: SubscribeToTopicProperties,
    SendEventProperties: SendEventProperties,
    SendBulkEventProperties, SendBulkEventProperties,
    BoldEventStreamConfiguration: BoldEventStreamConfiguration,
    BaseBoldEvent: BaseBoldEvent,
    BoldAutoCompleteEvent: BoldAutoCompleteEvent,
    BoldComponentEvent: BoldComponentEvent,
    BoldCustomEvent: BoldCustomEvent,
    BoldPageEvent: BoldPageEvent,
    BoldWidgetEvent: BoldWidgetEvent,
    BoldDictionaryEvent: BoldDictionaryEvent,
    getNewBoldEventObject: getNewBoldEventObject,
    getNewConfigurationObject: getNewConfigurationObject
};
},{}],4:[function(require,module,exports){
let EventModels = require('./eventModels_ES6');
let BoldMqttEventHandler = require('./boldMqttEventHandler.js');
//let BoldMqttEventHandler = {}
let BoldAjaxEventHandler = require('./boldAjaxEventHandler');

let _globalInternalVariables = {
    boldEventStreamConfiguration: null,
    mqttClientToBeUsed: null,
    ajaxClientToBeUsed: null,
    globalObject: null
};

//if initialization not done.....
_globalInternalVariables.boldEventStreamConfiguration = EventModels.getNewConfigurationObject();
_globalInternalVariables.boldEventStreamConfiguration.enableErrorThrown = true;
_globalInternalVariables.boldEventStreamConfiguration.enableConsoleLogging = true;


let InitializeBoldStreamObjectAsync = function (globalObject, parentHtmlTagForScripts, boldEventStreamConfiguration = null) {
    let mainProm = new Promise(function (resolve, reject) {
        globalObject.BoldEventStream = globalObject.BoldEventStream || {};
        if (_globalInternalVariables.boldEventStreamConfiguration.enableConsoleLogging)
            console.log("Initialization Process Started.");
        if (boldEventStreamConfiguration == null)
            boldEventStreamConfiguration = EventModels.getNewConfigurationObject();

        if (!boldEventStreamConfiguration instanceof EventModels.BoldEventStreamConfiguration)
            throw new Error("boldEventStreamConfiguration  not instance of 'BoldEventStreamConfiguration' use getNewConfigurationObject()");

        _globalInternalVariables.boldEventStreamConfiguration = boldEventStreamConfiguration;
        _globalInternalVariables.globalObject = globalObject;

        //initialize stuff needed.
        if (boldEventStreamConfiguration.Commons.defaultClientToInitialize == EventModels.Enums.SendClientToUse.Default)
            throw new Error('boldEventStreamConfiguration.Commons.defaultClientToInitialize not set properly, set something other then default.');



        let finalPromArr = [];
        if (boldEventStreamConfiguration.Commons.defaultClientToInitialize == EventModels.Enums.SendClientToUse.All
            || boldEventStreamConfiguration.Commons.defaultClientToInitialize == EventModels.Enums.SendClientToUse.Mqtt) {

            let p = globalObject.Paho || null;
            if (p == null && parentHtmlTagForScripts == null)
                throw new Error('Nither Paho found in Global Object nor parentHtmlTagForScripts is a HtmlNode ');

            let p1 = (p == null ? LoadDynamicScriptFileAsync(boldEventStreamConfiguration.MqttDetails.pahoMqttUrl, parentHtmlTagForScripts) : Promise.resolve())
                .then(function () {
                    return BoldMqttEventHandler.mqttCreateClientObjectAndConnect(globalObject, boldEventStreamConfiguration);
                })
                .then(function (mqttClient) {
                    _globalInternalVariables.mqttClientToBeUsed = mqttClient;
                })
            // no need to add another throw as Promise.all is used
            //.catch(function (ex) { reject(ex); });

            finalPromArr.push(p1);
        }
        if (boldEventStreamConfiguration.Commons.defaultClientToInitialize == EventModels.Enums.SendClientToUse.All
            || boldEventStreamConfiguration.Commons.defaultClientToInitialize == EventModels.Enums.SendClientToUse.Ajax) {

            if (!globalObject['fetch'])
                throw new Error('Fetch Api Not Found in Global Scope, initialize different "defaultClientToInitialize". ');
            let p2 = BoldAjaxEventHandler.ajaxCreateClientObject(boldEventStreamConfiguration)
                .then(function (ajaxClient) {
                    _globalInternalVariables.ajaxClientToBeUsed = ajaxClient;
                })
            // no need to add another throw as Promise.all is used
            // .catch(function (ex) { reject(ex); });
            finalPromArr.push(p2);
        }
        BoldEventStream.GlobalObjects = _globalInternalVariables;

        Promise.all(finalPromArr).then(function () {
            console.log("Initialization Process Completed.");
            resolve("Initialization Done");
        })
            .catch(function (ex) {
                reject(ex);
            });
    });// outer promise
    mainProm.catch(function (e) {
        console.log("%c BoldEventStream->InitializeBoldStreamObject Failed. Error is -  " + e.message, "background: Yellow;color:Red");
        if (_globalInternalVariables.boldEventStreamConfiguration.Commons.enableErrorThrown)
            throw e;
    });
    return mainProm;
}

let subscribeToTopicAsync = function (subscribeToTopicProperties) {
    let mainProm = new Promise(function (resolve, reject) {

        if (subscribeToTopicProperties == null || subscribeToTopicProperties.topicToSubscribe == null)
            throw new Error("subscribeToTopicProperties is invalid or null.");

        if (_globalInternalVariables.mqttClientToBeUsed == null)
            throw new Error("MqttClient not initialized, cannot Subscribe Events.");

        BoldMqttEventHandler.mqttSubscribeToTopic(_globalInternalVariables.mqttClientToBeUsed, subscribeToTopicProperties)

    });// main promise 
    mainProm.catch(function (e) {
        console.log("%c BoldEventStream->subscribeToTopicAsync Failed. Error is -  " + e.message, "background: Yellow;color:Red");
        if (_globalInternalVariables.boldEventStreamConfiguration.Commons.enableErrorThrown)
            throw e;
    });
    return mainProm;
};

let sendEventToServerAsync = function (eventObject, sendEventProperties = null) {
    let mainProm = new Promise(function (resolve, reject) {
        if (sendEventProperties == null)
            sendEventProperties = new EventModels.SendEventProperties();

        //event obj has value 
        if (eventObject == null || !eventObject instanceof EventModels.BaseBoldEvent) {
            throw new Error("Event Object Not Initialized Properly Or type mismatch detected.");
        }
        if (!sendEventProperties instanceof EventModels.SendEventProperties)
            throw new Error("sendEventProperties Object Not Initialized Properly Or type mismatch detected.");

        if (sendEventProperties.sendClientToUse == EventModels.Enums.SendClientToUse.Default)
            sendEventProperties.sendClientToUse = _globalInternalVariables.boldEventStreamConfiguration.Commons.defaultClientToUse;

        if (sendEventProperties.sendClientToUse == EventModels.Enums.SendClientToUse.All)
            throw new Error('sendEventProperties.sendClientToUse not set properly, set something other then All.');

        //set additional props
        eventObject.MessageSendTimeUtc = new Date().toISOString();

        if (sendEventProperties.sendClientToUse == EventModels.Enums.SendClientToUse.Ajax) {
            if (_globalInternalVariables.ajaxClientToBeUsed == null) {
                throw new Error("AjaxClient not initialized, cannot send Events.");
            }

            BoldAjaxEventHandler.ajaxSendEventToServer(_globalInternalVariables.ajaxClientToBeUsed, eventObject, sendEventProperties)
                .then(function (resp) {
                    resolve('Sent');
                })
                .catch(function (ex) { reject(ex); });

        }
        else if (sendEventProperties.sendClientToUse == EventModels.Enums.SendClientToUse.Mqtt) {
            if (_globalInternalVariables.mqttClientToBeUsed == null) {
                throw new Error("MqttClient not initialized, cannot send Events.");
            }
            BoldMqttEventHandler.mqttSendEventToServer(_globalInternalVariables.globalObject, _globalInternalVariables.mqttClientToBeUsed, eventObject, sendEventProperties)
                .then(function (resp) {
                    resolve('Sent');
                })
                .catch(function (ex) { reject(ex); });

        }
        else
            reject(new Error("sendEventProperties.sendClientToUse is not registered with framework."));
    });// outer promise 
    mainProm.catch(function (e) {
        console.log("%c BoldEventStream->sendEventToServer Failed. Error is -  " + e.message, "background: Yellow;color:Red");
        if (_globalInternalVariables.boldEventStreamConfiguration.Commons.enableErrorThrown)
            throw e;
    });
    return mainProm;
};

// let sendEventToServerWithoutInitializationAsync = function (eventObject, sendEventToServerWithoutInitializationProperties = null) {
//     let mainProm = new Promise(function (resolve, reject) {
//         if (sendEventToServerWithoutInitializationProperties == null || sendEventToServerWithoutInitializationProperties instanceof EventModels.SendEventWithoutInitializationProperties)
//             throw new Error("Send Properties not passed.");

//     });// outer promise 
//     mainProm.catch(function (e) {
//         console.log("%c BoldEventStream->sendEventToServerWithoutInitializationAsync Failed. Error is -  " + e.message, "background: Yellow;color:Red");
//         if (_globalInternalVariables.boldEventStreamConfiguration.Commons.enableErrorThrown)
//             throw e;
//     });
//     return mainProm;
// };

let sendEventToServerInBulkAsync = function (eventObject, sendBulkEventProperties = null) {
    try {
        if (sendBulkEventProperties == null)
            sendBulkEventProperties = new EventModels.SendBulkEventProperties();

        throw new Error("Method Not Implemented Yet.");

    }
    catch (e) {
        console.log("%c BoldEventStream->sendEventToServerInBulk Failed. Error is -  " + e.message, "background: Yellow;color:Red");
        if (_globalInternalVariables.boldEventStreamConfiguration.Commons.enableErrorThrown)
            throw e;
    }
}

let LoadDynamicScriptFileAsync = function (url, parentHtmlNode) {
    if (parentHtmlNode == null && self != null) { // in case of service workers.
        self.importScripts(url);
        return Promise.resolve();
    }
    //url is URL of external file location ,parentHtmlNode is location to
    //insert the <script> element
    return new Promise(function (resolve, reject) {
        try {
            let scriptTag = document.createElement('script');
            scriptTag.src = url;

            scriptTag.onload = resolve;
            scriptTag.onreadystatechange = resolve;

            parentHtmlNode.appendChild(scriptTag);
        } catch (ex) {
            reject(ex);
        }
    });
}


module.exports = {
    InitializeBoldStreamObjectAsync: InitializeBoldStreamObjectAsync,
    subscribeToTopicAsync: subscribeToTopicAsync,
    sendEventToServerAsync: sendEventToServerAsync,
    //sendEventToServerInBulkAsync: sendEventToServerInBulkAsync,
    ClassInitializers: {
        getNewConfigurationObject: EventModels.getNewConfigurationObject,
        getNewBoldEventObject: EventModels.getNewBoldEventObject,
        SendEventProperties: EventModels.SendEventProperties,
        SendBulkEventProperties: EventModels.SendBulkEventProperties,
        SubscribeToTopicProperties: EventModels.SubscribeToTopicProperties
    },
    Enums: {
        EventSubTypes: EventModels.Enums.EventSubTypes,
        SendClientToUse: EventModels.Enums.SendClientToUse
    },
    GlobalObjects: null
}
},{"./boldAjaxEventHandler":1,"./boldMqttEventHandler.js":2,"./eventModels_ES6":3}]},{},[4])(4)
});
