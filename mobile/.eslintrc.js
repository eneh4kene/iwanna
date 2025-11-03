module.exports = {
    root: true,
    extends: [
        'expo',
        '@react-native',
        '@typescript-eslint/recommended',
        'prettier',
    ],
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint', 'prettier'],
    rules: {
        'prettier/prettier': 'error',
        '@typescript-eslint/no-unused-vars': 'error',
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/explicit-function-return-type': 'warn',
        'react-native/no-inline-styles': 'warn',
        'react-hooks/exhaustive-deps': 'warn',
    },
    ignorePatterns: ['node_modules/', '.expo/', 'dist/'],
};
