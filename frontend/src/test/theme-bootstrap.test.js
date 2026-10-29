import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// npm test runs from frontend; avoid Vite treating new URL(public asset) as a web URL.
const bootstrap = readFileSync('public/theme-init.js','utf8');
test.each([
  ['dark',false,'dark'],['light',true,'light'],[null,true,'dark'],['invalid',false,'light'],
])('pre-paint bootstrap resolves saved=%s systemDark=%s to %s', (saved,dark,expected)=>{
  const meta=document.createElement('meta');meta.name='theme-color';document.head.append(meta);
  try {
    runInNewContext(bootstrap,{document,localStorage:{getItem:()=>saved},window:{matchMedia:()=>({matches:dark})}});
    expect(document.documentElement.dataset.theme).toBe(expected);
    expect(meta.content).toBe(expected==='dark'?'#121815':'#f7f8f4');
  } finally {meta.remove();delete document.documentElement.dataset.theme;}
});

test('pre-paint bootstrap tolerates blocked storage and unavailable matchMedia',()=>{
  runInNewContext(bootstrap,{document,localStorage:{getItem:()=>{throw new Error('blocked');}},window:{}});
  expect(document.documentElement.dataset.theme).toBe('light');
  delete document.documentElement.dataset.theme;
});
