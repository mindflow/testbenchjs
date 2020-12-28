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

        /** @type {Number} */
        this.runTestFunctionCount = 0;

        /** @type {Number} */
        this.runTestClassCount = 0;

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

    /**
     * Run all test classes
     */
    run() {
        Logger.listener = this.logListener;
        let classNameArray = [];
        this.testClassMap.forEach((key, value, parent) => {
            this.runTestClassList.add(value);
            this.runTestFunctionList.addAll(value.testFunctions());
            classNameArray.push(key);
            return true;
        });
        this.runClassNameAt(classNameArray, 0);
    }

    /**
     * Run test by class name
     * @param {string} className 
     */
    runSingle(className) {
        Logger.listener = this.logListener;
        this.runTestClassList.add(this.testClassMap.get(className));
        this.runClassNameAt([className], 0);
    }

    runClassNameAt(classNameArray, index) {

        if (index >= classNameArray.length) {
            return;
        }

        const className = classNameArray[index];

        this.runTestClassCount++;

        this.printHeader(className);
        this.loadObjectByClassName(className).then(() => {
            this.runFunctionsByClassName(className, () => {
                this.runClassNameAt(classNameArray, index+1);
            });

        });
    }

    loadObjectByClassName(className) {
        return new Promise((resolve, reject) => {
            const testClass = this.testClassMap.get(className);
            this.objectProvider.provide(testClass).then((testObject) => {
                this.testObjectMap.set(className, testObject);
                resolve();
            });
        });
    }

    /**
     * 
     * @param {String} className 
     * @param {Function} onComplete 
     */
    runFunctionsByClassName(className, onComplete) {
        const testClass = this.testClassMap.get(className);
        const testFunctions = testClass.testFunctions();
        const functionArray = [];

        testFunctions.forEach((value, parent) => {
            /** @type {Function} */
            const testFunction = value;
            functionArray.push(testFunction);
            return true;
        });

        if (functionArray.length > 0) {
            this.runFunctionAt(testClass, functionArray, 0, onComplete);
        }
    }

    /**
     * 
     * @param {Array} functionArray 
     * @param {Number} index 
     * @param {Function} onComplete
     */
    runFunctionAt(testClass, functionArray, index, onComplete) {
        if (functionArray.length <= index) {
            onComplete.call();
            return;
        }
        
        const testObject = this.testObjectMap.get(testClass.name);
        const testFunction = functionArray[index];

        /** @type {Promise} */
        let testFunctionResult = null;

        try {
            testFunctionResult = testFunction.call(testObject);
            if (!(testFunctionResult instanceof Promise)) {
                this.runTestFunctionCount ++;
                this.reportSuccess(testClass, testFunction);
                this.runFunctionAt(testClass, functionArray, index+1, onComplete);
            };
        } catch (exception) {
            this.runTestFunctionCount ++;
            this.reportFailure(testClass, testFunction, exception);
            this.runFunctionAt(testClass, functionArray, index+1, onComplete);
        }

        if (!(testFunctionResult instanceof Promise)) {
            return new Promise((resolve,reject) => { resolve(); });
        }

        testFunctionResult.then(() => {
            this.runTestFunctionCount ++;
            this.reportSuccess(testClass, testFunction);
            this.runFunctionAt(testClass, functionArray, index+1, onComplete);

        }).catch((exception) => {
            this.runTestFunctionCount ++;
            this.reportFailure(testClass, testFunction, exception);
            this.runFunctionAt(testClass, functionArray, index+1, onComplete);

        });
    }

    reportFailure(testClass, testFunction, exception) {
        this.addFail(testClass, testFunction);
        this.callResultListener(testClass, true);
        LOG.error(this.signature(testClass, testFunction) + " failed. Reason:");
        LOG.error(exception);
        LOG.error("");
        this.tryClose();
    }

    reportSuccess(testClass, testFunction) {
        this.addSuccess(testClass, testFunction);
        this.callResultListener(testClass, false);
        this.tryClose();
    }

    callResultListener(testClass, failed) {
        if (!this.resultListener) {
            return;
        }
        const result = failed ? TestClassResult.FAIL : TestClassResult.SUCCESS;
        this.resultListener.call(new TestClassResult(testClass.name, result));
    }

    addSuccess(testClass, testFunction) {
        this.runSuccessTestList.add(this.signature(testClass, testFunction));
    }

    addFail(testClass, testFunction) {
        this.runFailTestList.add(this.signature(testClass, testFunction));
    }

    signature(testClass, testFunction) {
        return testClass.name + "." + testFunction.name + "()";
    }

    tryClose() {
        if (this.runTestFunctionList.size() <= this.runTestFunctionCount && this.runTestClassList.size() <= this.runTestClassCount) {
            this.close();
        }
    }

    close() {
        try {
            this.printReport();
        } finally {
            this.reset();
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

    printReport() {
        LOG.info("###################");
        LOG.info("#   Test Report   #");
        LOG.info("###################");
        LOG.info("");

        LOG.info("Succeeded:");
        let successCounter = 0;
        this.runSuccessTestList.forEach((value,parent) => {
            LOG.info(successCounter++ + ". " + value);
            return true;
        });
        LOG.info("");

        LOG.info("Failed:");
        let failCounter = 0;
        this.runFailTestList.forEach((value,parent) => {
            LOG.info(failCounter++ + ". " + value);
            return true;
        });
        LOG.info("");

        if (failCounter != 0) {
            throw this.runFailTestList.size() + " Tests failed";
        }
    }

    reset() {
        this.runFailTestList = new List();
        this.runSuccessTestList = new List();

        this.runTestFunctionList = new List();
        this.runTestClassList = new List();

        this.runTestFunctionCount = 0;
        this.runTestClassCount = 0;
    }
}