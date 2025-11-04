export const helpTexts = {
  general: `
Usage: npx advantisui <command> [options]

Commands:
  add <components...>        Add one or more components
  list                       List available components
  help                       Show this help message
`,

  add: `
Usage: npx advantisui add <components...> [--name custom-names]

Options:
  --name <comma-separated>   Custom names for the components in order
  -h, --help                 Show this help message for 'add'
Examples:
  npx advantisui add button input
  npx advantisui add button input card --name custom-button,custom-input
`,
};
