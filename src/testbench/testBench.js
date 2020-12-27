import { List, Logger, Map, ObjectFunction } from "coreutil_v1";
import { ObjectProvider } from "./objectProvider";
import { TestClassResult } from "./testClassResult";
import { TestTrigger } from "./testTrigger";

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

        /** @type {List} */
        this.successTestMap = new List();

        /** @type {List} */
        this.failTestMap = new List();

        /** @type {ObjectProvider} */
        this.objectProvider = objectProvider;
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

    loadObjectByClassName(className) {
        return new Promise((resolve, reject) => {
            const testClass = this.testClassMap.get(className);
            this.objectProvider.provide(testClass).then((testObject) => {
                this.testObjectMap.set(className, testObject);
                resolve();
            });
        });
    }

    runFunctionsByClassName(className) {
        const testClass = this.testClassMap.get(className);

        /** @type {List} */
        const testFunctions = testClass.testFunctions();

        const testObject = this.testObjectMap.get(className);
        let failed = this.runFunctions(testFunctions, testClass, testObject);

        if (this.resultListener) {
            this.callResultListener(className, failed);
        }
    }

    runFunctions(testFunctions, testClass, testObject) {
        let failed = false;
        testFunctions.forEach((value, parent) => {
            /** @type {Function} */
            const testFunction = value;
            try {
                testFunction.call(testObject);
                this.successTestMap.add(testClass.name + "." + testFunction.name + "()");
            } catch (exception) {
                failed = true;
                LOG.error("Test: " + testClass.name + "." + testFunction.name + "() failed. Reason:");
                LOG.error(exception);
                LOG.error("");
                this.failTestMap.add(testClass.name + "." + testFunction.name + "()");
            }
            return true;
        });
        return failed;
    }

    callResultListener(className, failed) {
        if (failed) {
            this.resultListener.call(new TestClassResult(className, TestClassResult.FAIL));
        } else {
            this.resultListener.call(new TestClassResult(className, TestClassResult.SUCCESS));
        }
    }

    /**
     * Run test by class name
     * @param {string} className 
     */
    runSingle(className) {
        Logger.listener = this.logListener;
        this.printHeader(className);
        this.loadObjectByClassName(className).then(() => {
            this.runFunctionsByClassName(className);
            this.close();
        });
    }

    /**
     * Run all test classes
     */
    run() {
        Logger.listener = this.logListener;
        const loadObjectByClassNamePromises = [];

        let classNameArray = [];
        this.testClassMap.forEach((key, value, parent) => {
            classNameArray.push(key);
            return true;
        });
        this.runClassNameAt(classNameArray, 0);
    }

    runClassNameAt(classNameArray, index) {
        // No more classNames to run
        if (index >= classNameArray.length) {
            this.close();
            return;
        }

        const className = classNameArray[index];
        this.printHeader(className);
        this.loadObjectByClassName(className).then(() => {
            this.runFunctionsByClassName(className);
            this.runClassNameAt(classNameArray, index+1);
        });
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
        this.successTestMap.forEach((value,parent) => {
            LOG.info(successCounter++ + ". " + value);
            return true;
        });
        LOG.info("");

        LOG.info("Failed:");
        let failCounter = 0;
        this.failTestMap.forEach((value,parent) => {
            LOG.info(failCounter++ + ". " + value);
            return true;
        });
        LOG.info("");

        if (failCounter != 0) {
            throw this.failTestMap.size() + " Tests failed";
        }
    }

    reset() {
        this.failTestMap = new List();
        this.successTestMap = new List();
    }
}