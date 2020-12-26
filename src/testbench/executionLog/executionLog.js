import { Logger, Map } from "coreutil_v1";

const executionLogMap = new Map();

export class ExecutionLog {

    constructor(testName, listener) {
        this.testName = testName;
        this.listener = listener;
        /** @type {Logger} */
        this.log = new Logger(testName);
    }

    static create(testName) {
        if (!executionLogMap.contains(testName)) {
            executionLogMap.set(testName, new ExecutionLog(testName));
        }
    }

    debug(message) {
        if (this.listener) {
            this.listener.call(message, Logger.DEBUG);
        }
        this.log.debug(message);
    }

    info(message) {
        if (this.listener) {
            this.listener.call(message, Logger.INFO);
        }
        this.log.info(message);
    }

    warn(message) {
        if (this.listener) {
            this.listener.call(message, Logger.WARN);
        }
        this.log.warn(message);
    }

    error(message) {
        if (this.listener) {
            this.listener.call(message, Logger.ERROR);
        }
        this.log.error(message);
    }

    fatal(message) {
        if (this.listener) {
            this.listener.call(message, Logger.FATAL);
        }
        this.log.fatal(message);
    }

}