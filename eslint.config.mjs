import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

const eslintConfig = [
  ...nextCoreWebVitals,
  {
    rules: {
      // React Compiler diagnostics, and this app does not enable the compiler.
      //
      // immutability: off -- every occurrence here is "Cannot access variable
      // before it is declared" for effects that call a hoisted `async function
      // loadX()` declared below them. That is valid JavaScript and the shape
      // every page in this app uses; the rule reports nothing actionable.
      //
      // set-state-in-effect: warn, not off. The pre-existing hits are all
      // "reset derived state when an input changes" (sign-out resets,
      // usePagination's page reset) -- worth seeing but not worth failing CI
      // over, and not worth rewriting right now. Kept visible rather than
      // silenced because this is the rule family that catches state-vs-props
      // desync bugs like the one InterestButton had.
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
    ],
  },
];

export default eslintConfig;
