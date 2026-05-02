export const demoData = {
  company: {
    name: "Nordic Design AB",
    orgNr: "556123-4567",
    framework: "K3",
    fiscalYear: "2024-01-01 to 2024-12-31"
  },
  importSummary: {
    filename: "Nordic_Design_AB_2024.SE",
    accountsCount: 87,
    transactionsCount: 1243,
    period: "2024-01-01 to 2024-12-31",
    status: "completed"
  },
  mappedAccounts: [
    { account: "3000 Försäljning tjänster", position: "Nettoomsättning", confidence: "high", source: "3000" },
    { account: "3010 Försäljning produkter", position: "Nettoomsättning", confidence: "high", source: "3010" },
    { account: "5010 Lokalhyra", position: "Övriga externa kostnader", confidence: "medium", source: "5010" },
    { account: "5800 Kontorsmaterial", position: "Övriga externa kostnader", confidence: "medium", source: "5800" },
    { account: "7010 Löner tjänstemän", position: "Personalkostnader", confidence: "high", source: "7010" },
    { account: "8410 Räntekostnader", position: "Räntekostnader och liknande", confidence: "low", source: "8410" }
  ],
  incomeStatement: [
    { label: "Nettoomsättning", amount: 4850000 },
    { label: "Aktiverat arbete", amount: 0 },
    { label: "Övriga rörelseintäkter", amount: 125000, noteRef: 2 },
    { label: "Summa intäkter", amount: 4975000, isTotal: true },
    { label: "Råvaror", amount: -620000 },
    { label: "Övriga externa kostnader", amount: -1250000, noteRef: 3 },
    { label: "Personalkostnader", amount: -1890000, noteRef: 4 },
    { label: "Av- och nedskrivningar", amount: -180000, noteRef: 5 },
    { label: "Rörelseresultat", amount: 1035000, isTotal: true },
    { label: "Räntekostnader", amount: -42000 },
    { label: "Resultat efter finansiella poster", amount: 993000, isTotal: true },
    { label: "Skatt", amount: -218460 },
    { label: "Årets resultat", amount: 774540, isTotal: true }
  ],
  balanceSheet: {
    assets: [
      { label: "Immateriella anläggningstillgångar", amount: 320000, noteRef: 5 },
      { label: "Materiella anläggningstillgångar", amount: 890000, noteRef: 5 },
      { label: "Summa anläggningstillgångar", amount: 1210000, isTotal: true },
      { label: "Kundfordringar", amount: 1450000 },
      { label: "Övriga kortfristiga fordringar", amount: 185000 },
      { label: "Kassa och bank", amount: 2340000 },
      { label: "Summa omsättningstillgångar", amount: 3975000, isTotal: true },
      { label: "SUMMA TILLGÅNGAR", amount: 5185000, isTotal: true, isSummary: true }
    ],
    equityAndLiabilities: [
      { label: "Aktiekapital", amount: 100000 },
      { label: "Balanserat resultat", amount: 2810460 },
      { label: "Årets resultat", amount: 774540 },
      { label: "Summa eget kapital", amount: 3685000, isTotal: true },
      { label: "Långfristiga skulder", amount: 500000, noteRef: 6 },
      { label: "Leverantörsskulder", amount: 650000 },
      { label: "Övriga kortfristiga skulder", amount: 350000 },
      { label: "Summa skulder", amount: 1500000, isTotal: true },
      { label: "SUMMA EGET KAPITAL OCH SKULDER", amount: 5185000, isTotal: true, isSummary: true }
    ]
  },
  notes: [
    { number: 1, title: "Redovisningsprinciper", content: "Årsredovisningen är upprättad i enlighet med årsredovisningslagen (1995:1554) och BFNAR 2012:1 (K3)." },
    { number: 2, title: "Övriga rörelseintäkter", amount: 125000, content: "Erhållna bidrag och återbetalning av kostnader." },
    { number: 3, title: "Övriga externa kostnader", content: "Hyra 480 000 kr, IT och telekommunikation 320 000 kr, Revision och juridik 185 000 kr, Övrigt 265 000 kr. Totalt 1 250 000 kr." },
    { number: 4, title: "Anställda och personalkostnader", content: "Medelantal anställda: 12 (9 män, 3 kvinnor). Löner 1 540 000 kr, Sociala kostnader 350 000 kr. Totalt 1 890 000 kr." },
    { number: 5, title: "Av- och nedskrivningar", content: "Immateriella 85 000 kr, Materiella 95 000 kr. Totalt 180 000 kr. Utgående balans immateriella 320 000 kr, materiella 890 000 kr." },
    { number: 6, title: "Långfristiga skulder", content: "Banklån förfall 2027-06-30, räntesats 3.5%, belopp 500 000 kr." },
    { number: 7, title: "Ställda säkerheter", content: "Företagsinteckning 1 000 000 kr till Nordea Bank." },
    { number: 8, title: "Händelser efter balansdagen", content: "Inga väsentliga händelser har inträffat efter balansdagen." }
  ],
  validation: [
    { severity: "warning", code: "WARN-001", message: "Granska upplysning om personal", description: "Not 4 bör innehålla information om könsfördelning i styrelsen.", noteRef: 4 },
    { severity: "error", code: "ERR-001", message: "Not 3 saknar obligatoriskt belopp", description: "Specificering av övriga externa kostnader kräver belopp för varje post.", noteRef: 3 }
  ],
  overviewStatus: {
    import: "done",
    mapping: "done",
    statements: "draft",
    notes: "in_progress",
    validation: { warnings: 1, errors: 1 }
  }
};
