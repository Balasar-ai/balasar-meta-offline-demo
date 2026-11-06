# Herkomst, rechtenbesluit en afbakening

Basis: `940182e8bc28fc796f7d3b4ed0095b4d98d8844a`.
Opdracht: GO BUILD — BALASAR META STANDALONE DEMO | MIT, Harun Balasar, 5 november 2026.

## Toestemmingsgrond

Harun noemt zich in de opdracht eigenaar, geeft toestemming voor het afzonderlijke lokale pakket en kiest MIT uitsluitend voor de demonstratiecode. Dat is het eigenaarsbesluit waarop de licentietekst berust. Geen toestemming voor publicatie of herlicentiëring van de volledige oorspronkelijke repository.

De geselecteerde regels zijn rechtstreeks uit de opgegeven Git-commit gelezen. Blame wijst voor alle overgenomen functies en tests naar `harunbalasar`. Commitberichten van de eerste adaptercommit en de basiscommit vermelden daarnaast `Co-Authored-By: Claude Sonnet 5.5`. Deze AI-bijdrage is niet weggelaten uit de herkomstbeoordeling. Er zijn in de geselecteerde bron geen externe copyright-, SPDX-, kopieer- of portvermeldingen gevonden. Dat is een gerichte broncontrole, geen bewijs van afwezigheid van alle mogelijke rechten van derden.

De eerder ontbrekende bouw- en licentiekeuze zijn door deze nieuwe opdracht gegeven. Een afzonderlijke overeenkomst-/accountcontrole van de historische AI-invoer is niet uitgevoerd. De openbare release blijft afhankelijk van de onafhankelijke rechtenreview. Het pakket is lokaal gebleven.

## Overgenomen selecties

Alle bronpaden hieronder vallen onder `scripts/visibility-intelligence/`.

| Doel | Bronselectie | Herkomst | Wijziging |
|---|---|---|---|
| src/model-api.mjs | model-api.mjs volledig | f4f4827751d78d625d064421678c969230b99abe (26 oktober); fbf63a554ea8a9575a9ee6b193c4a02f4efccd29 en a98304bb6f475dacf710563fee30ffa0f61b41b4 (3 november); basiscommit (4 november) | Alleen twee importpaden |
| src/redaction.mjs | integrations.mjs:31 en 215–227 | 5fc111a5d2072b181b679775237a44b90f7d4907, 13 oktober | Selectie; functiebody's gelijk |
| src/contracts.mjs | store.mjs:5–6, 8–16, 18–29 | 8bfcc55933b5c285bde62c4fee08a472d41c67d4, 13 oktober | Imports apart; declaraties gelijk |
| src/local-evidence.mjs | store.mjs:6–7,16,30–146 | dezelfde opslagcommit | Alleen lokale opslag en noodzakelijke imports |
| tests/model-api.test.mjs | model-api.test.mjs volledig | De vier genoemde adaptercommits | Imports en bronleespad verplaatst; alle 135 gevallen behouden |
| tests/local-evidence.test.mjs | store.test.mjs:1–5,8–81 | dezelfde opslagcommit | Imports gesplitst; tien lokale tests behouden |
| tests/redaction.test.mjs | integrations.test.mjs:186–189 | dezelfde integratiecommit | Eén oorspronkelijke test plus twee nieuwe gevallen |

De overige demo-, test-, controle- en documentatiebestanden zijn voor deze opdracht gemaakt. Het lampvoorbeeld is de bestaande `SYNTHETIC_SCENARIO` uit de adapter. De overige nieuwe contexten, grants en responses zijn ter plaatse geconstrueerde fictieve gegevens. Geen klantbestanden of productiegegevens zijn ingelezen. Alle sleutelachtige waarden in de tests/demo zijn expliciet fictief; geen geheime sleutel is gebruikt.

`evidence/source-parity.json` bewijst gelijkheid van vijftien geselecteerde declaraties. De adapter is alleen op twee imports aangepast. Het oorspronkelijke adaptertestbestand heeft alleen gewijzigde imports en een aangepast relatief bronleespad. De broncode van de volledige integratie- en opslagmodules wordt niet meegeleverd.

## Externe onderdelen

De toepassing gebruikt alleen Node-standaardmodules. Vitest en zijn afhankelijkheden dienen uitsluitend voor tests. Hun eigen licenties blijven van toepassing; zij worden niet onder Haruns MIT-verklaring gebracht. Het pakket bevat geen node_modules, Node-binary, klantontwerp, foto, muziek of meegeleverd lettertype. De video gebruikt lokale terminaltekst met synthetische resultaten.

## Status

Bronselectie en herkomst gecontroleerd; private bouw en MIT-keuze door eigenaar geautoriseerd. Geen onafhankelijke verklaring van exclusief eigendom, geen onafhankelijke eindreview en geen openbare vrijgave. De bestaande werkboom is ongewijzigd gebleven; de geregistreerde vier reeds aanwezige wijzigingen zijn behouden.
