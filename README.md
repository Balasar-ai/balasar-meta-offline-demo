# Balasar Meta — zelfstandige offline demonstratie

**GEBOUWD / GETEST / REVIEW REQUIRED.** Lokale reviewkandidaat van 5 november 2026.

Dit programma laat zien hoe synthetische productgegevens gecontroleerd worden verwerkt. Alle modelantwoorden komen uit vaste lokale testgegevens. Het programma belt Meta niet, leest geen echte sleutel en start geen server. Er is geen klantcode, klantcatalogus, PostgreSQL of browserinterface nodig.

## Direct starten

Vereist: Node.js 24.21.0 of nieuwer binnen versie 24. Uitvoeren vanuit deze uitgepakte map:

```sh
node demo.mjs
```

Er zijn **geen runtimeafhankelijkheden**: npm-installatie is voor de demo niet nodig.

Voor machineleesbare uitvoer:

```sh
node demo.mjs --json
```

De demo maakt een eigen tijdelijke map, bewaart daarin synthetisch bewijs, sluit de opslag en opent die opnieuw. Daarna wordt die tijdelijke map verwijderd. De oorspronkelijke repository wordt niet gelezen. Andere opties, waaronder een live-optie, worden geweigerd.

## Wat werkelijk wordt getoond

1. Voorbereiding veroorzaakt geen aanroep, sleutelresolutie of reservering.
2. Eén gesimuleerd antwoord wordt verwerkt; prijs, voorraad en materiaal blijven onbekend.
3. Een verzonnen prijs wordt afgewezen.
4. Dezelfde grant kan niet opnieuw worden gebruikt, ook niet na sluiten en heropenen.
5. Een vervalste sessie wordt geweigerd; een andere tenant ziet geen bewijsrecords.
6. Beoordeling levert alleen een concept op. Wijziging van de bron blokkeert verder gebruik.
7. Een fictief geheim ontbreekt in resultaten en het opgeslagen bewijs.

Iedere getoonde stap bevat echte programmatische controles. Een mislukte controle geeft exitcode 1; een ongeldige opdrachtregel exitcode 2. Er is geen automatische herhaling van een modelpoging.

## Tests

Vitest 5.0.2 is uitsluitend een ontwikkelafhankelijkheid. De minimale lockfile omvat de benodigde afhankelijkheden en optionele platformpakketten, zonder de overige applicatiepakketten.

Met een gevulde npm-cache:

```sh
npm ci --offline --ignore-scripts --no-audit --no-fund
npm run quality
```

Op een schone computer kan het nodig zijn de testpakketten eerst van npm te downloaden met `npm ci --ignore-scripts --no-audit --no-fund`. Dat is een externe pakketdownload, geen Meta-aanroep. Tijdens deze bouw zijn de testpakketten offline uit de bestaande cache geïnstalleerd.

168 tests slagen: 135 adaptertests, 10 opslagtests, 15 contracttests, 3 redactietests en 5 aanvullende zelfstandigheids-/fouttests. De kwaliteitscontrole controleert bovendien JavaScript-syntax, toegestane imports, nul runtimeafhankelijkheden en afwezigheid van een omgeving-/netwerkroute in de uitvoeringscode. Geen oorspronkelijke testverwachting is afgezwakt. Zie `evidence/quality-windows.log` en `evidence/source-parity.json`.

De eerste proef vond een verouderd relatief pad in een test die de adapterbron leest. Alleen dat pad is aangepast aan de afsplitsing; daarna slagen alle 168 gevallen. De eerste installatiepoging zonder lockfile miste npm-cachemetadata. De beperkte lockfile uit de bestaande exacte afhankelijkheden maakte `npm ci --offline` mogelijk.

## Bewijs en grenzen

- Volledige suite en terminaldemo: Windows, Node 24.21.0.
- Terminaldemo: Linux, Node 24.22.1, lege credentialomgeving en een seccomp-filter dat netwerksockets weigert; een afzonderlijke controle bevestigde de blokkade. Zie `evidence/network-sandbox.json`.
- De JavaScript-netwerkbewaking is extra bescherming voor dit gecontroleerde programma, geen zandbak voor willekeurige code.
- De contextfactory simuleert een vertrouwde serverrol. De demo bewijst geen echte login, gehoste tenantrollen of RLS.
- Heropenen na netjes sluiten is getest. Volledig herstel na stroomuitval is niet bewezen. Een achtergebleven lock blijft blokkerend.
- De lokale hashketen is geen handtekening of onafhankelijk verankerd auditbewijs.
- Invoer is begrensde gewone JSON-data zonder cycli, getters of dunbezette arrays. De overgenomen helpers zijn niet bedoeld als generieke verdediging tegen kwaadaardige JavaScript-objecten.
- De endpoint-, model- en prijsconstanten zijn overgenomen historische bronconfiguratie. De demo bevestigt geen actuele beschikbaarheid, factuur, credits of financieel plafond. Kostenvelden in de fixture zijn geen werkelijk providerverbruik.

## Licentie en herkomst

Harun koos op 5 november 2026 MIT voor uitsluitend dit afzonderlijke demonstratiepakket. `LICENSE` voert dat besluit uit voor de eigen demonstratiecode; het verleent geen licentie op de volledige oorspronkelijke repository of op klantmateriaal. Externe testpakketten behouden hun eigen licenties, waaronder MIT, Apache-2.0, MPL-2.0, ISC en BSD-3-Clause: zie `THIRD_PARTY_NOTICES.md`.

De overgenomen code is exact afgebakend in `PROVENANCE.md`. Git-herkomst, functiepariteit en het eigenaarsbesluit zijn vastgelegd. Dit is geen garantie dat alle mogelijke rechten van derden zijn uitgesloten. De onafhankelijke eindreview en afzonderlijke publicatie-GO blijven open.

## Video en openbare repository

De begeleidende video is een neutrale terminalweergave van de werkelijk uitgevoerde offline demo, met ingelaste leestijd. Het is geen opname van een live Meta-model. De originele JSON-uitvoer is meegeleverd.

Voorstel voor latere publicatie: `Balasar-ai/balasar-meta-offline-demo` — naamvoorstel, beschikbaarheid niet gecontroleerd. Alleen dit pakket na onafhankelijke review en expliciete eigenaar-GO. Geen geschiedenis, klantmateriaal, node_modules of bestaande repository publiceren. Er is geen repository, workflow of deployment gemaakt.
