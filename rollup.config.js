import multi from '@rollup/plugin-multi-entry';
import webes from 'plugin-webes';
import { terser } from "rollup-plugin-terser";

export default [{
    input: "src/**/*.js",
    external: [ 'coreutil_v1' ],
    output: {
        name: 'testbench_v1',
        file: "dist/jsm/testbench_v1.js",
        sourcemap: "inline",
        format: "es"
    },
    plugins: [
        multi(),
        webes({
            'coreutil_v1': './coreutil_v1.js',
            replaceStage: 'renderChunk'
        })
    ]
},{
    input: "src/**/*.js",
    external: [ 'coreutil_v1' ],
    output: {
        name: 'testbench_v1',
        file: "dist/jsm/testbench_v1.min.js",
        format: "es"
    },
    plugins: [
        multi(),
        webes({
            'coreutil_v1': './coreutil_v1.js',
            replaceStage: 'renderChunk'
        }),
        terser()
    ]
},{
    input: "src/**/*.js",
    external: [ 'coreutil_v1' ],
    output: {
        name: 'testbench_v1',
        file: "dist/cjs/testbench_v1.js",
        sourcemap: "inline",
        format: "cjs"
    },
    plugins: [
        multi()
    ]
}]
