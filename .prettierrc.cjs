module.exports = {
    printWidth: 120,
    semi: false,
    tabWidth: 4,
    plugins: ["@trivago/prettier-plugin-sort-imports"],
    importOrder: ["^react$", "<THIRD_PARTY_MODULES>", "^@/", "^[./]"],
    importOrderSeparation: true,
}
