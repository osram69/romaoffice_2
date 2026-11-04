import type { Guide } from "./guides";

const RELATED_COMMON: [string, string][] = [["Registered office address in Rome", "/en/legal-headquarters-domiliation.html"], ["Pricing and offers", "/en/pricing.html"], ["All business address services", "/en/domiliation-services.html"]];

export const guidesEn: Record<string, Guide> = {
  "cambio-sede-legale-roma.html": {
    eyebrow: "PRACTICAL GUIDE",
    h1: "Changing your registered office to Rome: step by step",
    lead: "Moving a company’s registered office to Rome, or from one Rome address to another, takes a decision by the shareholders or directors, a filing with the Italian Business Register and updates to your bank, invoices and documents. Here are the steps in order, the legal deadlines and the mistakes to avoid.",
    facts: [
      ["Who decides", "The shareholders’ meeting or the board, depending on the articles of association"],
      ["Filing deadline", "30 days from the decision, through the Comunicazione Unica to the Business Register"],
      ["Your new address", "Via Venti Settembre 118, minutes from Roma Termini"],
      ["Agreement", "3 to 48 months, activated online"],
    ],
    sections: [
      {
        h: "First: a new city, or just a new street?",
        p: [
          "This question decides everything else. If the company is already based in Rome and only moves from one street to another, many articles of association state only the municipality: the change of street then does not amend the articles and usually needs no notary, because a decision of the board, notified to the Business Register, is enough.",
          "If the company is moving from another municipality, or its articles state the full address, the transfer is an amendment of the articles: an extraordinary shareholders’ meeting with a notarial deed is required. Sole proprietors need no resolution at all: the owner simply notifies the change.",
        ],
        note: "Always check the articles of association with your accountant or notary before deciding: the clause on the registered office determines which route applies.",
      },
      {
        h: "The steps in order",
        ol: [
          "Check the articles and identify who must approve the transfer (shareholders or directors).",
          "Request the registered office service in Rome and sign the agreement. Wait for written activation before using the address in official documents: using an address without an agreement means declaring a seat that is not really at the company’s disposal.",
          "Draft the resolution or declaration with the full address: Via Venti Settembre, 118 int. 1 - 00187 Rome.",
          "File with the Business Register through the Comunicazione Unica (ComUnica), with a digital signature, within 30 days of the decision. The filing is normally made by your accountant or notary. The same filing informs the Revenue Agency, INPS and INAIL, so you do not need to notify each body separately.",
          "Update banks, insurers, suppliers, clients, website, letterhead, email signatures and invoice templates. Tax code, VAT number and PEC do not change.",
          "Close the previous address in an orderly way: agree with the old address until when mail is still collected and by whom.",
        ],
      },
      {
        h: "What you need to activate the service",
        p: ["Activation starts with the online request, a mobile-number check with an SMS code and the agreement. You will usually need:"],
        ul: [
          "the legal representative’s ID document and tax code;",
          "an up-to-date company register extract (or the company details if it is being incorporated);",
          "the documents for customer due diligence required by anti-money-laundering rules;",
          "for existing companies, at least one of a PEC email address and an SDI code;",
          "the place where the accounting records are kept (often the accountant’s office) and any authorisations for collecting mail.",
        ],
        note: "Reception confirms the exact checklist for your application: documents may vary with the type of company and activity.",
      },
      {
        h: "What it costs",
        p: [
          "There are three cost items. The first is the address service: the table below shows current prices, and the longer the agreement the lower the monthly cost. The second is the Business Register filing, with secretariat fees and stamp duty that depend on the type of company and filing. The third is the notary (if a notarial deed is needed) and the professional who handles the filing: always ask for a written quote.",
          "For reference, a late-2025 industry survey by Ufficiarredati.it covering over 70 coworking and business-centre operators found yearly fees for a registered office alone between roughly €420 and €1,200, with Rome among the most expensive cities. Be wary of much lower prices: an address that is too cheap can cause problems with banks, tax authorities and clients.",
        ],
      },
      {
        h: "Common mistakes",
        ul: [
          "Using the new address in documents before activation is confirmed.",
          "Missing the 30-day deadline: late filing can lead to penalties.",
          "Moving the seat but leaving the old details on invoices, contracts and the website.",
          "Expecting to keep accounting books and tax documents at the centre’s address: it is not an archive, and the place where accounting records are kept is declared separately.",
          "Not telling the bank: many banks ask for updated documents and the new address agreement.",
        ],
      },
      {
        h: "After the move: mail and the Customer Area",
        p: [
          "From the start date, reception receives and safely holds your company’s mail, including registered letters and parcels within the authorisations you provide, and notifies you when new mail arrives. Mail is collected during reception hours (Monday to Friday, 8:30-19:00) by the legal representative or an identified authorised person; forwarding is agreed separately.",
          "In the Customer Area you will find your agreement and related documents. If you also need a place to meet clients or suppliers, you can book a day office or a meeting room in the same building.",
        ],
      },
    ],
    priceAfter: 3,
    faq: [
      ["Do I need a notary to change my registered office to Rome?", "It depends on the articles. If the company is already in Rome and the articles state only the municipality, changing the street is usually a decision of the board, without a notary. If you change municipality or the articles state the full address, a notarial amendment is required. Always check with your professional."],
      ["How soon must the change be notified?", "The filing with the Business Register is due within 30 days of the resolution or decision to transfer, through the Comunicazione Unica."],
      ["Can I use the new address straight away?", "Wait for written activation and the agreed start date: only from then is the address at the company’s disposal and can it be used in official documents."],
      ["Do my VAT number and tax code change?", "No. Tax code and VAT number stay the same; the tax domicile changes, which for companies is the registered office. The update reaches the Revenue Agency through the Comunicazione Unica, but you must show the new address on invoices."],
      ["Can I keep accounting books at the centre?", "No. The address is not a place for keeping accounting records and tax documents: the agreement asks where they are kept, usually at the accountant’s office."],
      ["Does this apply to sole proprietors?", "Yes, but without a resolution: the owner notifies the change of address through the Comunicazione Unica. See also the page on addresses for sole proprietors."],
    ],
    related: [...RELATED_COMMON, ["Registered office for startups", "/en/startup-registered-office-rome.html"], ["Sole proprietor business address", "/en/sole-proprietorship-domiliation.html"]],
  },

  "sede-legale-startup-srls-roma.html": {
    eyebrow: "FOR STARTUPS AND NEW COMPANIES",
    h1: "Registered office for startups and S.r.l.s. in Rome",
    lead: "Setting up a startup or a simplified S.r.l. (S.r.l.s.) in Rome does not require renting an office: you need a real address, an agreement and a manned mail service. Here is when a registered office address is the right choice, how to state it in the incorporation deed and how to grow the setup with the company.",
    facts: [
      ["S.r.l.s. share capital", "From €1 to €9,999.99"],
      ["Registered office", "Stated in the incorporation deed: choose it before incorporating"],
      ["Agreement", "3 to 48 months, activated online"],
      ["Space when needed", "Meeting rooms by the hour and offices even for a single day"],
    ],
    sections: [
      {
        h: "Why a startup can start without an office",
        p: [
          "In the first months a new company has few certain costs and many unknowns: the team works remotely, meetings with clients and investors are occasional, and a lease would be a fixed cost incurred before any revenue. With a registered office address the company has a representative address in Rome, near Termini, and pays only for what it uses.",
          "The agreement runs from 3 to 48 months, and the longer it is the lower the monthly cost. When you need physical space you book it separately: meeting rooms by the hour (from €25 an hour + VAT), a day office for a working day or a temporary office for a few months. The setup grows with the company without changing address.",
        ],
      },
      {
        h: "Registered office and S.r.l.s.: what to know",
        p: [
          "The simplified S.r.l. is a limited liability company with share capital between €1 and €9,999.99 and standard articles. As for any company, the incorporation deed states the municipality of the registered office and the filing with the Business Register the full address. The notary or accountant may ask you to show that the address is really at your disposal: the address agreement is the document to provide.",
          "So the correct order is: request the service, wait for written activation, give the address to the notary and only then incorporate. For a new company the final details (company name, tax code and registration number) are sent after incorporation.",
        ],
      },
      {
        h: "Innovative startups: what changes",
        p: [
          "To register the company in the special section for innovative startups, its main place of business and interests must be in Italy, but the address alone is not enough: registration depends on other requirements, such as an innovative business purpose and criteria on research, team and intellectual property. You assess those with your accountant; a registered office address in Rome is compatible with having the seat in Italy.",
        ],
        note: "The rules for innovative startups and SMEs change over time: check the current requirements with the Chamber of Commerce or your adviser.",
      },
      {
        h: "Address, day office or office: which to choose",
        table: {
          head: ["Your situation", "Best fit"],
          rows: [
            ["Newly incorporated, no employees", "Registered office address"],
            ["Remote team, a few meetings a month", "Registered office address + meeting room by the hour"],
            ["Pitching to clients or investors", "Equipped meeting room with screen and video conferencing"],
            ["Working on site only on some days", "Registered office address + day office"],
            ["First permanent staff on site", "Temporary or furnished office"],
          ],
        },
      },
      {
        h: "The steps, from request to incorporation",
        ol: [
          "Choose the agreement length and send the online request: enter the details, verify your mobile with an SMS code and complete payment.",
          "Sign the agreement and provide the documents: the representative’s ID and tax code and the customer due diligence documents.",
          "Wait for written activation and the start date.",
          "Give the address to your notary or accountant and incorporate the company.",
          "Once incorporated, send the final details and say where the accounting records will be kept.",
          "Start receiving mail: reception notifies you when mail arrives and holds it until collection.",
        ],
      },
      {
        h: "Very low prices: the risks for a new company",
        p: [
          "For a brand-new company, banks and notaries also look at the address. Addresses sold for a few euros a day, without a structured operator and a reception, can complicate opening a bank account, tax checks and your credibility with clients. A late-2025 industry survey (Ufficiarredati.it, over 70 operators) notes that such very low prices cannot be traced to coworking and business-centre operators. Service quality matters more than saving a few tens of euros.",
        ],
      },
    ],
    priceAfter: 2,
    faq: [
      ["Can an S.r.l.s. have its registered office at a business address?", "Yes, as long as the address is at the company’s disposal under an agreement and the activity is compatible with the service. The notary, the accountant and the centre check the requirements of each company before activation."],
      ["Can I incorporate before activating the service?", "It is not advisable: the address should be stated in documents only after written activation, otherwise the company would declare a seat it does not yet have at its disposal."],
      ["Does an innovative startup need an office?", "The address alone does not decide registration in the special section: the main place of business must be in Italy and the legal requirements must be met. Check with your accountant or the Chamber of Commerce."],
      ["How much does it cost?", "It depends on the agreement length, from 3 to 48 months, and is shown in the price table on this page, always up to date. Activation is online."],
      ["Can I change office later?", "Yes. As the company grows you can add offices or rooms, or move the seat following the procedure in our guide to changing your registered office."],
      ["Can I also receive partners’ or staff mail?", "The service covers the company’s mail and that of the persons you name as authorised in the agreement: ask reception about special cases."],
    ],
    related: [...RELATED_COMMON, ["Changing your registered office", "/en/change-registered-office-rome.html"], ["Meeting rooms in Rome", "/en/course-rooms.html"], ["Day office", "/en/day-office.html"]],
  },

  "domiciliazione-societa-estere-roma.html": {
    eyebrow: "FOR FOREIGN COMPANIES AND SHAREHOLDERS",
    h1: "Registered office in Rome for foreign companies and shareholders",
    lead: "Anyone opening a company in Italy from another country needs a real address, documents in order and a manned mail service. Here are the available structures, what a foreign director needs and how an address in Rome works.",
    facts: [
      ["Two scenarios", "An Italian company with foreign shareholders or directors, or the branch of a foreign company"],
      ["Typical documents", "ID and Italian tax code, foreign company records with apostille and translation if requested"],
      ["Website", "Available in Italian and English"],
      ["Address", "Via Venti Settembre 118, Rome, near Termini"],
    ],
    sections: [
      {
        h: "Two different cases: Italian company or branch",
        p: [
          "The first case is an Italian company (for example an S.r.l.) whose shareholders or directors are foreigners. As far as the registered office goes nothing changes: the company has a registered office in Italy, stated in the incorporation deed, like any other company.",
          "The second case is a company already incorporated abroad that wants to operate in Italy. It can open a branch (sede secondaria) with a permanent representative, registered with the Business Register, or operate in a way that creates a permanent establishment for tax purposes. They are different structures with different corporate and tax consequences: the choice should be made with an adviser. An address in Italy is not needed for a foreign company’s VAT obligations alone, which are handled in other ways.",
        ],
        note: "This page is for information only and does not replace professional advice: requirements and obligations vary with the country of origin and the activity.",
      },
      {
        h: "What a foreign shareholder or director needs",
        ul: [
          "A valid ID document or passport.",
          "An Italian tax code, requested from the Revenue Agency or, from abroad, from an Italian consulate.",
          "A digital signature to sign Business Register filings, or the help of a notary or accountant who files on your behalf.",
          "A PEC email address for the company: mandatory for Italian companies and the channel for many official communications.",
          "A bank account for the share capital and operations: banks apply enhanced checks when shareholders do not live in Italy.",
        ],
        note: "Requirements depend on nationality and role: your notary and accountant confirm the list for your case.",
      },
      {
        h: "What the company gets with an address in Rome",
        p: [
          "With the registered office service the company has a real address in central Rome, a few minutes from Termini and Metro Line A, and a reception that receives and holds correspondence. For those living abroad what matters most is being sure to receive documents, registered letters and notifications: the registered office is where the company must be reachable.",
          "Reception notifies you when new mail arrives and hands it to the legal representative or an identified authorised person during opening hours (Monday to Friday, 8:30-19:00). If you are not in Italy, name a trusted person in the agreement who can collect your mail, or agree forwarding in advance: arrangements and charges must be confirmed beforehand, as they are not included in the fee.",
          "The address does not replace an operating office or any licences for the activity. If you need a place to meet clients or work when you are in Rome, you can book a meeting room or day office in the same building.",
        ],
      },
      {
        h: "Documents to activate the service",
        p: ["Reception confirms the list for your application. Typically you will be asked for:"],
        ul: [
          "the legal representative’s passport or ID card and Italian tax code;",
          "for a foreign company, an extract from the registry of the country of origin and its articles, with apostille or legalisation and translation where required;",
          "details to identify the beneficial owner, as required by anti-money-laundering rules on customer due diligence;",
          "at least one of a PEC email address and an SDI code, for existing companies;",
          "authorisations for collecting mail and where the accounting records are kept.",
        ],
      },
      {
        h: "How to start from far away",
        ol: [
          "Discuss with your adviser the best structure: an Italian company or a branch.",
          "Send the address request online. If the SMS mobile check or the online form is a problem, you can ask for the form or a quote by email.",
          "Sign the agreement and upload your documents: the Customer Area lets you consult the agreement and related documents.",
          "Wait for written activation, then give the address to the notary or professional who incorporates the company or registers the branch.",
          "Say who collects mail in Italy, or agree forwarding.",
        ],
      },
    ],
    priceAfter: 3,
    faq: [
      ["Can a foreign company use your address?", "Yes, as the registered office of an Italian company controlled by foreign shareholders or as the address of a branch, subject to checks on the activity and documents. Reception confirms feasibility for each case before activation."],
      ["Do I need someone in Italy to collect mail?", "It is advisable. Mail is handed to the legal representative or an identified authorised person; if nobody can collect it, forwarding is agreed separately with arrangements and charges confirmed in advance."],
      ["Can I activate the service from abroad?", "The request is completed online, with an SMS mobile check. If that step is not possible in your case, contact us: you can request the form or a quote by email."],
      ["What language is the agreement in?", "The agreement is in Italian. The website and service information are also available in English; contact us for any clarification on the clauses."],
      ["Do I need an Italian tax code?", "Yes, for representatives and shareholders of an Italian company. It is requested from the Revenue Agency or, from abroad, from an Italian consulate."],
      ["Is an address enough to start a business in Italy?", "No. The address solves the registered office, but corporate and tax filings and any licences remain the responsibility of the client and their advisers."],
    ],
    related: [...RELATED_COMMON, ["Registered office for startups", "/en/startup-registered-office-rome.html"], ["Changing your registered office", "/en/change-registered-office-rome.html"]],
  },

  "sede-legale-virtuale-roma.html": {
    eyebrow: "REGISTERED OFFICE AND VAT NUMBER",
    h1: "Virtual registered office in Rome: costs, limits and VAT number",
    lead: "A “virtual registered office” means a registered office address service: a real address in Rome, with reception and mail handling, without renting an office. Here is what it allows and what it does not, how it works for a VAT number and how much it costs.",
    facts: [
      ["What it is", "A real address in Rome used as your seat, with mail handling"],
      ["Reception", "Monday to Friday, 8:30-19:00"],
      ["Agreement", "3 to 48 months, activated online"],
      ["Prices", "Public, in the table on this page"],
    ],
    sections: [
      {
        h: "Virtual registered office: what it really means",
        p: [
          "The law has no category called a “virtual seat”: a company has a registered office, a real place in Italy where it can be reached and receives communications. A registered office service provides that place: a real address in central Rome, with a reception that receives and holds mail, without you having to rent and furnish an office.",
          "That is why it differs from an address used without an agreement, known in the trade as abusive domiciliation: if an address is used without an agreement with whoever runs it, mail is not received and the company risks challenges. The agreement, the activation confirmation and a manned reception make the difference.",
        ],
      },
      {
        h: "What you can and cannot do with the address",
        p: ["With a registered office address you can:"],
        ul: [
          "state the address as the company’s registered office, within the agreement, on documents, website and correspondence;",
          "have mail received and held, including registered letters and parcels within the authorisations you provide;",
          "book a meeting room or a day office for meetings;",
          "add a virtual secretary with a dedicated phone number.",
        ],
      },
      {
        h: "The limits to know",
        ul: [
          "The address is not an archive: accounting books, records and tax documents must be kept elsewhere, usually at the accountant’s office, and the place is declared separately.",
          "It is not an operating office or a warehouse: activities that need suitable premises, licences or public access must be checked case by case.",
          "Use as a professional address depends on the rules of your professional body.",
          "Mail is collected during reception hours by the representative or an authorised person; forwarding is agreed separately.",
        ],
      },
      {
        h: "A VAT number with a virtual registered office",
        p: [
          "For a company the tax domicile is the registered office: if the seat is a business address in Rome, so is the tax domicile. There is no separate tax-domicile service: it follows from the registered office.",
          "For sole proprietors and professionals the tax domicile is normally their residence, while the business address can be stated as the seat or place where the activity is carried on, in the Comunicazione Unica for businesses or in form AA9/12 for the self-employed. When opening your VAT number, check with your accountant whether your activity can use this address.",
        ],
        note: "Whether the address is suitable depends on the activity: speak to your adviser before using it in filings.",
      },
      {
        h: "How much a registered office in Rome costs",
        p: [
          "The table shows service prices for each agreement length, always up to date and with no hidden fees. For comparison, the late-2025 industry survey by Ufficiarredati.it over 70 operators puts yearly fees for a registered office alone between roughly €420 and €1,200, with Rome among the most expensive cities and Treviso, Pesaro and Como among the cheapest.",
          "Price depends on the area, the operator’s reputation, the services included (mail handling, checks, compliance) and the number of companies at the same address. A fee far below average is a warning sign.",
        ],
      },
      {
        h: "How to choose a reliable offer",
        ul: [
          "A written agreement and activation confirmation before you use the address.",
          "An identifiable operator: company name, VAT number, REA number and a real office.",
          "A manned reception with clear hours and transparent mail handling (collection, forwarding, charges).",
          "Public prices and understandable renewal terms.",
          "A reasonable number of companies at the same address, and real spaces you can book when needed.",
        ],
      },
      {
        h: "Virtual address or office: a comparison",
        table: {
          head: ["Solution", "For whom", "What it includes"],
          rows: [
            ["Registered office address", "Companies and sole proprietors wanting an official seat in Rome", "Address as registered office, mail receipt and safekeeping"],
            ["Business mailing address", "Anyone wanting a mailing address separate from home", "Correspondence address, without moving the seat"],
            ["Virtual secretary", "Anyone wanting a professional phone number", "Dedicated number, calls answered in the company’s name, message forwarding"],
            ["Day office or room", "Those who sometimes meet clients or need to work", "Space bookable by the hour or day, services included"],
          ],
        },
      },
    ],
    priceAfter: 4,
    faq: [
      ["Is a virtual registered office legal?", "A company must have a seat in Italy and be able to receive communications. A registered office service with an agreement and reception is a common solution; suitability for your activity should be checked with your adviser."],
      ["Can I open a VAT number with this address?", "For a company the tax domicile is the registered office. For sole proprietors and professionals the address can be stated as the seat or place of the activity, while the tax domicile stays their residence: check with your accountant."],
      ["How is it different from a business mailing address?", "The mailing address is only for correspondence and does not allow registering a company seat at the centre. To use the address as your company’s seat you need the registered office service."],
      ["Can I receive registered letters and parcels?", "Yes, within the authorisations you provide. Collection is during reception hours by the representative or an authorised person."],
      ["Can I also have a phone number?", "Yes, with the virtual secretary: a dedicated number, calls answered in your company’s name and message forwarding, from 6 months."],
      ["How long is the agreement?", "From 3 to 48 months. The longer the agreement, the lower the monthly cost."],
    ],
    related: [...RELATED_COMMON, ["Business mailing address", "/en/postal-domiliation.html"], ["Virtual secretary", "/en/virtual-secretary.html"], ["Sole proprietor business address", "/en/sole-proprietorship-domiliation.html"]],
  },
};
