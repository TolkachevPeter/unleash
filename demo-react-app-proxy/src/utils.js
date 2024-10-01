export function generateAppNames(count) {
    const appNames = [];
    for (let i = 1; i <= count; i++) {
      appNames.push(`frontend-app-${i}`);
    }
    return appNames;
  }
  