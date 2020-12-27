export class TestClassResult {

    static get SUCCESS() { return 1; }
    static get FAIL() { return 0; }

    /**
     * 
     * @param {String} className 
     * @param {String} result 
     */
    constructor(className, result) {

        /** @type {String} */
        this.className = className;
        
        /** @type {String} */
        this.result = result;
    }
}