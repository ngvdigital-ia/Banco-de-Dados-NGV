import assert from "node:assert/strict";
import test from "node:test";
import { criarDebounce } from "../src/components/sistemas/spy/debounce.mjs";

test("debounce: arrastos rápidos do slider viram UMA chamada só, com o último valor", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let chamadas = 0;
  let ultimoValor = null;
  const debounced = criarDebounce((valor) => {
    chamadas++;
    ultimoValor = valor;
  }, 500);

  debounced(10);
  t.mock.timers.tick(100);
  debounced(20);
  t.mock.timers.tick(100);
  debounced(30);
  assert.equal(chamadas, 0, "nenhuma chamada disparou ainda — cada arrasto reseta o timer");

  t.mock.timers.tick(499);
  assert.equal(chamadas, 0);
  t.mock.timers.tick(1);
  assert.equal(chamadas, 1, "só depois de 500ms sem novo arrasto");
  assert.equal(ultimoValor, 30, "só o ÚLTIMO valor chega na função real");
});

test("debounce: duas janelas separadas viram duas chamadas", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let chamadas = 0;
  const debounced = criarDebounce(() => chamadas++, 500);

  debounced();
  t.mock.timers.tick(500);
  assert.equal(chamadas, 1);

  debounced();
  t.mock.timers.tick(500);
  assert.equal(chamadas, 2);
});

test("debounce: cancel() impede a chamada pendente", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let chamadas = 0;
  const debounced = criarDebounce(() => chamadas++, 500);
  debounced();
  debounced.cancel();
  t.mock.timers.tick(1000);
  assert.equal(chamadas, 0);
});
