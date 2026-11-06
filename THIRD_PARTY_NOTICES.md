# Externe componenten

De MIT-licentie in de hoofdmap geldt voor de eigen code van dit afzonderlijke demonstratiepakket. Zij vervangt geen licenties van externe componenten.

De terminaldemo heeft nul externe runtimepakketten. Node.js wordt door de gebruiker geïnstalleerd en is niet meegeleverd.

Voor tests wordt Vitest 5.0.2 gebruikt, met Vite 8.3.0 als vereiste peer-afhankelijkheid. De minimale lockfile omvat 60 pakketvermeldingen inclusief optionele platformvarianten; op de gebruikte Windows-computer werden 35 pakketten geïnstalleerd. Er is geen React- of klantinterface nodig.

De volledige lijst met namen, versies, integriteitswaarden en verklaarde licenties staat in `evidence/dependency-licenses.json`. Aangetroffen licentie-identificaties: MIT, Apache-2.0, MPL-2.0, ISC en BSD-3-Clause. Deze lijst is een metadata-inventaris, geen garantie over iedere ingebedde upstreamlicentie. De originele pakketlicenties blijven in de geïnstalleerde pakketten aanwezig.

Geen van die pakketten of hun binaries wordt in het bronpakket gebundeld. Wie later afhankelijkheden of een uitvoerbaar installatiepakket meelevert, moet ook de toepasselijke licentieteksten en verplichte vermeldingen opnemen en die distributie afzonderlijk reviewen. De lokale metadata-inventaris vervangt geen actuele kwetsbaarhedenscan.
