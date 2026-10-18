import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync,statSync} from "node:fs";
import {dirname,join} from "node:path";
import {URL,fileURLToPath} from "node:url";
import ts from "typescript";
// Consumers install the plugin without node_modules, so code reachable from the two entry points may only import modules the Paseo host provides.
// Importing anything else, even a type-only import such as @getpaseo/protocol, makes the install build fail.
const root=fileURLToPath(new URL("..",import.meta.url));
const allowed=/^(\.|node:|react$|react-native$|zod$|@tanstack\/react-query$|@getpaseo\/plugin(\/|$))/;
// Every module reference in a source file, found through the TypeScript parser so comments and strings never count.
function specifiers(source:string,file="x.ts"){
 const found:string[]=[];
 const literal=(node:ts.Node|undefined)=>node&&ts.isStringLiteralLike(node)?node.text:"<non-literal module reference>";
 const visit=(node:ts.Node)=>{
  if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier)found.push(literal(node.moduleSpecifier));
  else if(ts.isExternalModuleReference(node))found.push(literal(node.expression));
  else if(ts.isImportTypeNode(node))found.push(ts.isLiteralTypeNode(node.argument)?literal(node.argument.literal):"<non-literal module reference>");
  else if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||(ts.isIdentifier(node.expression)&&node.expression.text==="require")))found.push(literal(node.arguments[0]));
  ts.forEachChild(node,visit);
 };
 visit(ts.createSourceFile(file,source,ts.ScriptTarget.ES2022,true,file.endsWith("x")?ts.ScriptKind.TSX:ts.ScriptKind.TS));
 return found;
}
const resolve=(from:string,specifier:string)=>[".ts",".tsx","/index.ts","/index.tsx",""].map(suffix=>join(dirname(from),specifier)+suffix).find(path=>existsSync(path)&&statSync(path).isFile());
function reachable(entries:string[]){
 const seen=new Set<string>(),queue=[...entries];
 while(queue.length){
  const file=queue.pop()!;if(seen.has(file))continue;seen.add(file);
  for(const specifier of specifiers(readFileSync(file,"utf8"),file).filter(x=>x.startsWith("."))){const next=resolve(file,specifier);assert.ok(next,`${file} imports ${specifier}, which does not resolve`);queue.push(next);}
 }
 return [...seen];
}
test("code reachable from the entry points imports only host-provided modules",()=>{
 const files=reachable([join(root,"index.client.tsx"),join(root,"index.server.ts")]);
 assert.ok(files.length>10,"the walk should reach the client, server and shared modules");
 for(const file of files)for(const specifier of specifiers(readFileSync(file,"utf8"),file))assert.match(specifier,allowed,`${file.slice(root.length)} imports ${specifier}, which consumers would not have installed`);
});
test("the import scanner sees every way of referencing a module and ignores comments and strings",()=>{
 const forms=`
  import a from "m1";
  import type { B } from "m2";
  import {
    c,
    d,
  } from "m3";
  export * from "m4";
  export { e } from "m5";
  import f = require("m6");
  const g = require("m7");
  const h = await import("m8");
  type I = import("m9").I;
  let j: typeof import("m10");
  import("m" + suffix);
  // import "commented-out";
  const text = 'from "in-a-string"';
 `;
 assert.deepEqual(specifiers(forms),["m1","m2","m3","m4","m5","m6","m7","m8","m9","m10","<non-literal module reference>"]);
 assert.deepEqual(specifiers("const x = <T,>(y: T) => y; <div>{x}</div>","x.tsx"),[]);
});
