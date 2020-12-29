import { List, Logger, Map, ObjectFunction } from "coreutil_v1";
import { ObjectProvider } from "./objectProvider.js";
import { TestClassResult } from "./testClassResult.js";
import { TestTrigger } from "./testTrigger.js";

const LOG = new Logger("TestBench");

export class TestBench extends TestTrigger {

    /**
     * 
     * @param {ObjectFunction} logListener 
     * @param {ObjectFunction} resultListener 
     * @param {ObjectProvider} objectProvider
     */
    constructor(logListener = null,
            resultListener = null, 
            objectProvider = new ObjectProvider()) {
        
        super();

        /** @type {ObjectFunction} */
        this.logListener = logListener;

        /** @type {ObjectFunction} */
        this.resultListener = resultListener;

        /** @type {Map} */
        this.testClassMap = new Map();

        /** @type {Map} */
        this.testObjectMap = new Map();

        /** @type {ObjectProvider} */
        this.objectProvider = objectProvider;

        /** @type {List} */
        this.runSuccessTestList = new List();

        /** @type {List} */
        this.runFailTestList = new List();
        
        /** @type {List} */
        this.runTestFunctionList = new List();

        /** @type {List} */
        this.runTestClassList = new List();

    }

    /**
     * 
     * @param {Object} testObject 
     * @returns {TestBench}
     */
    addTest(testClass) {
        if (!testClass.testFunctions || !(testClass.testFunctions() instanceof List)) {
            throw "A static function called 'testFunctions' must be provided in " 
                + testClass.name 
                + " which returns a List all the test functions in "
                + testClass.name + ".prototype"
        }
        this.testClassMap.set(testClass.name, testClass);
        return this;
    }

    contains(testClass) {
        return this.testClassMap.contains(testClass.name);
    }

    run() {
        Logger.listener = this.logListener;
        let parent = this;
        return this.testClassMap.promiseChain(this.runClass, this).then(() => {
            this.close(parent);
        });
    }

    /**
     * Run test by class name
     * @param {string} className 
     */
    runSingle(className) {
        Logger.listener = this.logListener;
        let testClass = this.testClassMap.get(className);
        let parent = this;
        return this.runClass(className, testClass, this).then(() => {
            this.close(parent);
        });
    }

    runClass(className, testClass, parent) {
        return new Promise((resolve, reject) => {
            parent.runTestClassList.add(testClass);
            parent.runTestFunctionList.addAll(testClass.testFunctions());
            parent.printHeader(className);
            parent.loadObjectByClassName(className, parent).then(() => {
                parent.runFunctionsByClassName(className, parent).then(() => {
                    resolve();
                });
            });
        });
    }

    loadObjectByClassName(className, parent) {
        return new Promise((resolve, reject) => {
            const testClass = parent.testClassMap.get(className);
            parent.objectProvider.provide(testClass).then((testObject) => {
                parent.testObjectMap.set(className, testObject);
                setTimeout(() => {
                    resolve();
                },1000);
            });
        });
    }

    /**
     * 
     * @param {String} className 
     * @param {Object} parent 
     */
    runFunctionsByClassName(className, parent) {
        const testClass = parent.testClassMap.get(className);
        /** @type {List} */
        const testFunctions = testClass.testFunctions();
        return testFunctions.promiseChain((testFunction) => {
            return new Promise((functionCompleteResolve, reject) => {
                parent.runFunction(testClass, testFunction, functionCompleteResolve, parent);
            });
        }, parent);
    }

    /**
     * 
     * @param {Array} functionArray 
     * @param {Number} index 
     * @param {Function} functionCompleteResolve
     */
    runFunction(testClass, testFunction, functionCompleteResolve, parent) {
        
        const testObject = parent.testObjectMap.get(testClass.name);

        /** @type {Promise} */
        let testFunctionResult = null;

        try {
            testFunctionResult = testFunction.call(testObject);
            if (!(testFunctionResult instanceof Promise)) {
                parent.reportSuccess(testClass, testFunction, parent);
            };
        } catch (exception) {
            parent.reportFailure(testClass, testFunction, exception, parent);
        }

        if (!(testFunctionResult instanceof Promise)) {
            functionCompleteResolve();
            return;
        }

        testFunctionResult.then(() => {
            parent.reportSuccess(testClass, testFunction, parent);
            functionCompleteResolve();
        }).catch((exception) => {
            parent.reportFailure(testClass, testFunction, exception, parent);
            functionCompleteResolve();
        });
    }

    reportFailure(testClass, testFunction, exception, parent) {
        parent.addFail(testClass, testFunction, parent);
        parent.callResultListener(testClass, true, parent);
        LOG.error(this.signature(testClass, testFunction) + " failed. Reason:");
        LOG.error(exception);
        LOG.error("");
    }

    reportSuccess(testClass, testFunction, parent) {
        parent.addSuccess(testClass, testFunction, parent);
        parent.callResultListener(testClass, false, parent);
    }

    callResultListener(testClass, failed, parent) {
        if (!parent.resultListener) {
            return;
        }
        const result = failed ? TestClassResult.FAIL : TestClassResult.SUCCESS;
        parent.resultListener.call(new TestClassResult(testClass.name, result));
    }

    addSuccess(testClass, testFunction, parent) {
        parent.runSuccessTestList.add(parent.signature(testClass, testFunction));
    }

    addFail(testClass, testFunction, parent) {
        parent.runFailTestList.add(parent.signature(testClass, testFunction));
    }

    signature(testClass, testFunction) {
        return testClass.name + "." + testFunction.name + "()";
    }

    close(parent) {
        try {
            parent.printReport(parent);
        } finally {
            parent.reset(parent);
            Logger.clearListener();
        }
    }

    printHeader(testName) {
        const line = "#  Running test: " + testName + "  #";
        let decoration = "";
        for (let i = 0; i < line.length ; i++) {
            decoration = decoration + "#";
        }
        LOG.info(decoration);
        LOG.info(line);
        LOG.info(decoration);
        LOG.info("");
    }

    printReport(parent) {
        LOG.info("###################");
        LOG.info("#   Test Report   #");
        LOG.info("###################");
        LOG.info("");

        let successCounter = 0;
        if (parent.runSuccessTestList.size() > 0){
            LOG.info("Succeeded:");
            parent.runSuccessTestList.forEach((value,parent) => {
                LOG.info(successCounter++ + ". " + value);
                return true;
            });
            LOG.info("");
        }

        let failCounter = 0;
        if (parent.runFailTestList.size() > 0){
            LOG.info("Failed:");
            parent.runFailTestList.forEach((value,parent) => {
                LOG.info(failCounter++ + ". " + value);
                return true;
            });
            LOG.info("");
        }

        if (failCounter != 0) {
            throw parent.runFailTestList.size() + " Tests failed";
        }
    }

    reset(parent) {
        parent.runFailTestList = new List();
        parent.runSuccessTestList = new List();

        parent.runTestFunctionList = new List();
        parent.runTestClassList = new List();
    }
}