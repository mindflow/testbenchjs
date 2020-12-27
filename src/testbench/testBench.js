import { List, Logger, Map, ObjectFunction } from "coreutil_v1";
import { TestTrigger } from "./testTrigger";

const LOG = new Logger("TestBench");

export class TestBench extends TestTrigger {

    /**
     * 
     * @param {ObjectFunction} listener 
     */
    constructor(listener = null) {
        
        super();

        /** @type {ObjectFunction} */
        this.listener = listener;

        /** @type {Map} */
        this.testMap = new Map();

        /** @type {List} */
        this.successTestMap = new List();

        /** @type {List} */
        this.failTestMap = new List();
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
        this.testMap.set(testClass.name, testClass);
        return this;
    }

    contains(testClass) {
        return this.testMap.contains(testClass.name);
    }

    named(className) {
        this.printHeader(className);

        const testClass = this.testMap.get(className);
        const testObject = new testClass();

        /** @type {List} */
        const testFunctions = testClass.testFunctions();

        testFunctions.forEach((value, parent) => {
            /** @type {Function} */
            const testFunction = value;
            try {
                testFunction.call(testObject);
                this.successTestMap.add(testClass.name + "." + testFunction.name + "()");
            } catch (exception) {
                LOG.error("Test: " + testClass.name + "." + testFunction.name + "() failed. Reason:");
                LOG.error(exception);
                LOG.error("");
                this.failTestMap.add(testClass.name + "." + testFunction.name + "()");
            }
            return true;
        });
    }

    /**
     * Run test by class name
     * @param {string} className 
     */
    runSingle(className) {
        Logger.listener = this.listener;
        this.named(className);
        this.printReport();
        this.reset();
        Logger.clearListener();
    }

    /**
     * Run all test classes
     */
    run() {
        Logger.listener = this.listener;
        this.testMap.forEach((key, value, parent) => {
            this.named(key);
            return true;
        });
        this.printReport();
        this.reset();
        Logger.clearListener();
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
        });
        LOG.info("");

        LOG.info("Failed:");
        let failCounter = 0;
        this.failTestMap.forEach((value,parent) => {
            LOG.info(failCounter++ + ". " + value);
        });
        LOG.info("");

        if (this.fails != 0) {
            throw this.failTestMap.size() + "Tests failed";
        }
    }

    reset() {
        this.failTestMap = new List();
        this.successTestMap = new List();
    }
}