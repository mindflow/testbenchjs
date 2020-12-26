import { List, Logger, Map } from "coreutil_v1";
import { ExecutionLog } from "./executionLog/executionLog.js";

const LOG = new Logger("TestBench");

export class TestBench {

    constructor() {
        this.executionLogMap = new Map();

        this.testMap = new Map();

        this.successTestMap = new List();
        this.failTestMap = new List();
    }

    /**
     * 
     * @param {Object} testObject 
     * @returns {TestBench}
     */
    addTest(name, testClass) {
        if (!testClass.testFunctions || !(testClass.testFunctions() instanceof List)) {
            throw "A static function called 'testFunctions' must be provided in " 
                + testClass.name 
                + " which returns a List all the test functions in "
                + testClass.name + ".prototype"
        }
        this.executionLogMap.set(name, new ExecutionLog("TestBench." + name));
        this.testMap.set(name, testClass);
        return this;
    }

    runNamed(name) {
        this.printHeader(name);
        const log = this.executionLogMap.get(name);
        const testClass = this.testMap.get(name);
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
                log.error("Test: " + testClass.name + "." + testFunction.name + "() failed. Reason:");
                log.error(exception);
                log.error("");
                this.failTestMap.add(testClass.name + "." + testFunction.name + "()");
            }
            return true;
        });
    }

    runSingle(name) {
        this.runNamed(name);
        this.printReport();
        this.reset();
    }

    run() {
        this.testMap.forEach((key, value, parent) => {
            this.runNamed(key);
            return true;
        });
        this.printReport();
        this.reset();
    }

    printHeader(testName) {
        const log = this.executionLogMap.get(testName);
        const line = "#  Running test: " + testName + "  #";
        let decoration = "";
        for (let i = 0; i < line.length ; i++) {
            decoration = decoration + "#";
        }
        log.info(decoration);
        log.info(line);
        log.info(decoration);
        log.info("");
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