// Debug the JSON.stringify issue in onclick attr
const q = "What are Ethan's books?";
const s = JSON.stringify(q);
console.log("JSON.stringify result:", s);
// When used in: `onclick="abRunQuestion(this,${JSON.stringify(q)})"`
// The result would be: onclick="abRunQuestion(this,"What are Ethan's books?")"
// The double quotes around the string break out of the HTML attribute!
const attr = `onclick="abRunQuestion(this,${s})"`;
console.log("HTML attribute:", attr);
console.log("Problem: this HTML attribute has unbalanced quotes!");

// Fix: Use single quotes for the onclick attribute
// or: replace inner " with &quot; or use a different approach like data attributes

// Option 1: Use single quotes wrapping the attr (not possible in template literal easily)
// Option 2: Replace double quotes in the JSON output with HTML entities
const fixed1 = `onclick="abRunQuestion(this,${s.replace(/"/g, '&quot;')})"`;
console.log("\nFixed (HTML entities):", fixed1);

// Option 3: Use data attribute approach
const dataAttr = `data-question="${q.replace(/"/g, '&quot;')}" onclick="abRunQuestion(this, this.dataset.question)"`;
console.log("Fixed (data attr):", dataAttr);
