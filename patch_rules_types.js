const fs = require('fs');

// 1. Patch firestore.rules
let rules = fs.readFileSync('firestore.rules', 'utf-8');
if (!rules.includes("linkedDebtId")) {
    rules = rules.replace(
        "&& (data.get('reserveModificationsMonth', '') is string);",
        "&& (data.get('reserveModificationsMonth', '') is string)\n        && (data.get('linkedDebtId', '') is string);"
    );
    fs.writeFileSync('firestore.rules', rules, 'utf-8');
    console.log('Patched firestore.rules');
}

// 2. Patch src/types.ts
let types = fs.readFileSync('src/types.ts', 'utf-8');
if (!types.includes("linkedDebtId?: string")) {
    types = types.replace(
        "reserveModificationsMonth?: string;",
        "reserveModificationsMonth?: string;\n  linkedDebtId?: string;"
    );
    fs.writeFileSync('src/types.ts', types, 'utf-8');
    console.log('Patched src/types.ts');
}
