export type Publication = {
  title: string;
  year: number;
  journal: string;
  doi?: string;
  doiUrl?: string;
  pubmedUrl?: string;
};

export const publications: Publication[] = [
  {
    title:
      "Effect of Silica-Modified Aluminum Oxide Abrasion on Adhesion to Dentin, Using Total-Etch and Self-Etch Systems",
    year: 2023,
    journal: "Polymers",
    doi: "10.3390/polym15020446",
    doiUrl: "https://doi.org/10.3390/polym15020446",
    pubmedUrl: "https://pubmed.ncbi.nlm.nih.gov/36679840/"
  },
  {
    title: "Ultrastructure and bonding properties of tribochemical silica-coated zirconia",
    year: 2018,
    journal: "Dental Materials Journal",
    doi: "10.4012/dmj.2017-397",
    doiUrl: "https://doi.org/10.4012/dmj.2017-397"
  }
];
