# ETU Conditions

A Foundry VTT v14 module for a Cypher System hack about Ether-Tech units. It tracks Temperature, Target Lock, Jammed, Recoil, and Hacked on tokens, and shows them as small labels above each token. It never blocks a roll.

Status: conditions and token labels work through a macro API. The radial token menu and roll dialog pre-fill come next. See `docs/SCOPE.md` for the spec and `docs/TESTING.md` for install and test steps.

```js
const etu = game.modules.get('fhl-etu-conditions').api;
await etu.set(undefined, 'temperature', 2);   // selected tokens become Hot
await etu.adjust(undefined, 'targetLock', 1); // raise Target Lock by 1
```
