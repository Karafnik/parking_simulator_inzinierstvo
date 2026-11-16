# Simulátor parkovacej garáže (Parkovací systém B)

Interaktívny prototyp k dokumentu **Detailný návrh riešenia (DNR) – Parkovací systém B**, verzia 1.1.
Predmet: softvérové inžinierstvo.

**Online:** https://karafnik.github.io/parking_simulator_inzinierstvo/

## Čo simulátor ukazuje

Jedna stránka bez servera a databázy. Beží celá v prehliadači.

- **Pôdorys garáže** s 24 miestami (4 s nabíjaním), stavom z rezervácií a senzorov a obsadenosťou s hranicou 80 %.
- **Zákazník:** vyhľadanie miesta (F.01), rezervácia (F.02), automatický výber (F.03), opakovaná rezervácia (F.04), dynamická cena (F.05), predplatné (F.06), upozornenia na voľné miesto (F.07), úhrada cez simulovanú platobnú bránu (F.13).
- **Správca:** zmena dostupnosti miest a vyhradenie pre skupiny VIP a zamestnanci (F.08).
- **Zariadenia:** kamera EČV a rampy (F.11), senzory obsadenosti (F.09), nabíjacie stanice (F.10), ukončenie rezervácie a presun na iné miesto (F.12).
- **Denník** prejazdov, platieb, notifikácií a zmien správcu.

Pravidlá a ilustračné hodnoty (2 €/h, prirážka ×1,5 od 80 %, vjazd 15 minút vopred, doplatok 4 € za začatú hodinu, nabíjanie 1 €/h) pochádzajú z kapitoly 6 dokumentu. Ceny predplatených balíkov a rozsah mesačného a ročného predplatného sú vymyslené.

## Súbory

| Súbor | Obsah |
|---|---|
| `index.html` | Celý simulátor (štýly, logika aj rozhranie v jednom súbore) |
| `logic.js` | Logika bez rozhrania. Rovnaký kód je vložený do `index.html` |
| `test.js` | Testy logiky pre Node.js |

## Spustenie

Otvor `index.html` v prehliadači. Testy logiky:

```
node test.js
```

## Obmedzenia

- Čas simulácie ide len dopredu, tlačidlo *Obnoviť simuláciu* vráti všetko na začiatok.
- Test súbehu beží v jednom vlákne, ukazuje kontrolu prekrytia rezervácií (N.05, I.01), nie skutočnú súbežnosť.
- Údaje sú ukážkové a po zavretí stránky sa neukladajú.
