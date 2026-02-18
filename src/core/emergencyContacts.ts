export interface EmergencyContact {
  name: string;
  hotline: string;
  hours?: string;
  notes?: string;
}

export const MALAYSIA_BANK_HOTLINES: EmergencyContact[] = [
  { name: "Maybank", hotline: "1-300-88-6688", hours: "24/7" },
  { name: "CIMB Bank", hotline: "03-6204 7788", hours: "24/7" },
  { name: "Public Bank", hotline: "03-2176 6000", hours: "24/7" },
  { name: "RHB Bank", hotline: "03-9206 8118", hours: "24/7" },
  { name: "Hong Leong Bank", hotline: "03-7626 8899", hours: "24/7" },
  { name: "AmBank", hotline: "03-2178 8888", hours: "24/7" },
  { name: "Bank Islam", hotline: "03-2088 8175", hours: "24/7" },
  { name: "BSN", hotline: "1-300-88-1900", hours: "24/7" },
  { name: "Bank Rakyat", hotline: "1-300-80-5454", hours: "24/7" },
  { name: "Affin Bank", hotline: "03-8888 1111", hours: "24/7" },
  { name: "Alliance Bank", hotline: "03-5516 9988", hours: "24/7" },
  { name: "OCBC Bank", hotline: "03-8317 5000", hours: "24/7" },
  { name: "Standard Chartered", hotline: "03-7711 1111", hours: "24/7" },
  { name: "HSBC", hotline: "03-2075 3000", hours: "24/7" },
  { name: "UOB", hotline: "03-2612 6000", hours: "24/7" },
];

export const EWALLET_HOTLINES: EmergencyContact[] = [
  { name: "Touch 'n Go eWallet", hotline: "03-5022 3042", hours: "9am-6pm" },
  { name: "GrabPay", hotline: "03-6206 0000", hours: "24/7" },
  { name: "Boost", hotline: "03-9212 3033", hours: "9am-9pm" },
  { name: "ShopeePay", hotline: "03-2777 8xxx", hours: "9am-6pm" },
];

export const NATIONAL_CONTACTS: EmergencyContact[] = [
  { 
    name: "NSRC (National Scam Response Centre)", 
    hotline: "997", 
    hours: "8am-8pm daily",
    notes: "Coordinates immediate inter-bank freezes"
  },
  { 
    name: "Bank Negara Malaysia", 
    hotline: "1-300-88-5465", 
    hours: "9am-5pm weekdays",
    notes: "Financial consumer complaints"
  },
  { 
    name: "PDRM CCID (Cybercrime)", 
    hotline: "03-2266 2222", 
    hours: "24/7",
    notes: "Report online fraud and cybercrime"
  },
  { 
    name: "MCMC (Telecom Issues)", 
    hotline: "1-800-18-8030", 
    hours: "24/7",
    notes: "Report SIM swap, number spoofing"
  },
];

export function formatContactList(contacts: EmergencyContact[], language: 'en' | 'bm'): string {
  const header = language === 'bm' 
    ? '**Nombor Kecemasan:**\n\n' 
    : '**Emergency Hotlines:**\n\n';
  
  const lines = contacts.map(c => {
    const hours = c.hours ? ` (${c.hours})` : '';
    const notes = c.notes ? `\n  _${c.notes}_` : '';
    return `• **${c.name}**: ${c.hotline}${hours}${notes}`;
  });
  
  return header + lines.join('\n');
}

export function getBankHotlinesMessage(language: 'en' | 'bm'): string {
  const bankList = formatContactList(MALAYSIA_BANK_HOTLINES.slice(0, 8), language);
  const nationalList = formatContactList(NATIONAL_CONTACTS, language);
  
  if (language === 'bm') {
    return `${bankList}\n\n**Nombor Nasional:**\n\n${nationalList}\n\n_Hubungi bank anda DAHULU untuk bekukan akaun, kemudian hubungi NSRC 997._`;
  }
  
  return `${bankList}\n\n**National Hotlines:**\n\n${nationalList}\n\n_Call your bank FIRST to freeze accounts, then call NSRC 997._`;
}

export function getPoliceGuideMessage(language: 'en' | 'bm'): string {
  if (language === 'bm') {
    return `**Panduan Laporan Polis:**

1. **Pergi ke balai polis terdekat** atau failkan online di **semakmule.rmp.gov.my**

2. **Nyatakan kategori**: Penipuan online / Scam siber

3. **Bawa bukti:**
   • Screenshot semua chat dengan scammer
   • Resit pemindahan wang / transaksi
   • Alamat dompet / nombor akaun penerima
   • Timeline kejadian (tarikh, masa, jumlah)

4. **Minta nombor laporan polis** - anda perlukan ini untuk tuntutan bank

5. **Semak status di semakmule.rmp.gov.my** dengan nombor akaun mencurigakan

_Laporan polis adalah WAJIB untuk bank proses tuntutan fraud._`;
  }
  
  return `**Police Report Guide:**

1. **Go to nearest police station** or file online at **semakmule.rmp.gov.my**

2. **State category**: Online fraud / Cyber scam

3. **Bring evidence:**
   • Screenshots of all chats with scammer
   • Transfer receipts / transaction records
   • Wallet addresses / recipient account numbers
   • Timeline of events (dates, times, amounts)

4. **Get police report number** - you need this for bank claims

5. **Check status at semakmule.rmp.gov.my** with suspicious account numbers

_Police report is MANDATORY for banks to process fraud claims._`;
}

export function getNSRCGuideMessage(language: 'en' | 'bm'): string {
  if (language === 'bm') {
    return `**NSRC 997 - Pusat Respons Scam Kebangsaan:**

📞 **Hubungi: 997**
🕐 **Waktu**: 8 pagi - 8 malam setiap hari

**Mereka boleh:**
• Bekukan akaun bank penipu merentas semua bank (dalam masa 2 jam jika pantas)
• Koordinasi antara bank anda dan bank penerima
• Rekod kes anda dalam sistem nasional
• Rujuk ke polis / BNM jika perlu

**Siap sedia dengan:**
• Nombor akaun penerima / alamat dompet
• Jumlah dan masa transaksi
• Nama bank anda dan bank penipu

_NSRC adalah pintu masuk terpantas untuk bekukan dana yang dipindahkan._`;
  }
  
  return `**NSRC 997 - National Scam Response Centre:**

📞 **Call: 997**
🕐 **Hours**: 8am - 8pm daily

**They can:**
• Freeze scammer accounts across all banks (within 2 hours if fast)
• Coordinate between your bank and recipient bank
• Log your case in national system
• Refer to police / BNM if needed

**Be ready with:**
• Recipient account number / wallet address
• Amount and time of transaction
• Your bank name and scammer's bank

_NSRC is the fastest gateway to freeze transferred funds._`;
}
