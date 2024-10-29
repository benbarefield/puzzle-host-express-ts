import typescript from "@rollup/plugin-typescript";
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
  input: "src/index.ts",
  output: {
    dir: 'dist',
  },
  plugins: [nodeResolve(), typescript()],
  external: [/node_modules/, "tslib"],
}
