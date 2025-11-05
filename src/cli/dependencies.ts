export const componentDependencies: Record<string, string[]> = {
  button: [
    "@radix-ui/react-slot",
    "class-variance-authority"
  ],
};

export const componentRelations = {
  contextmenu: ["button"],
  dropdown: ["button"],
};
