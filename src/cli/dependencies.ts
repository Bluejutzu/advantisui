export const componentDependencies: Record<string, string[]> = {
  button: [
    "@radix-ui/react-slot@^1.2.3",
  ],
};

export const componentRelations = {
  contextmenu: ["button"],
  dropdown: ["button"],
};
