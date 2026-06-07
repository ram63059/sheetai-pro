const headers = [" ", "Session Plan"];
const rowValues = ["P4", "Math lesson"];

function buildFuzzyRowObject(headers, rowValues) {
  const exact = {};
  const normalized = {};
  for (let i = 0; i < headers.length; i++) {
    const val = rowValues[i] ?? "";
    exact[headers[i]] = val;
    normalized[headers[i].trim().toLowerCase()] = val;
  }
  return new Proxy(exact, {
    get(target, prop) {
      if (typeof prop !== "string") return Reflect.get(target, prop);
      if (prop in target) return target[prop];
      const key = prop.trim().toLowerCase();
      if (key in normalized) return normalized[key];
      for (const h of Object.keys(normalized)) {
        if (h.includes(key) || key.includes(h)) return normalized[h];
      }
      return undefined;
    },
    has(target, prop) {
      if (typeof prop !== "string") return Reflect.has(target, prop);
      if (prop in target) return true;
      const key = prop.trim().toLowerCase();
      return key in normalized;
    }
  });
}

const rowObj = buildFuzzyRowObject(headers, rowValues);
const condition = "String(row[' '] || '').toLowerCase().includes('p4')";
const func = new Function("row", `return ${condition}`);

console.log("Result:", !!func(rowObj));
