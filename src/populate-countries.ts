import { DatabaseManager } from './database/DatabaseManager';
import { Logger } from './utils/Logger';

const logger = new Logger('info');

const countries = [
  // Top 100 Countries by GDP (in billions USD, 2023 data)
  
  // Top 10 - Major World Powers (excluding USA as this is a US-focused bot)
  { name: 'China', code: 'CN', continent: 'Asia', capital: 'Beijing', population: 1412000000, gdp: 17734, government: 'One-Party Socialist Republic', leader: 'Xi Jinping' },
  { name: 'Japan', code: 'JP', continent: 'Asia', capital: 'Tokyo', population: 125000000, gdp: 4940, government: 'Constitutional Monarchy', leader: 'Fumio Kishida' },
  { name: 'Germany', code: 'DE', continent: 'Europe', capital: 'Berlin', population: 83000000, gdp: 4259, government: 'Federal Parliamentary Republic', leader: 'Olaf Scholz' },
  { name: 'India', code: 'IN', continent: 'Asia', capital: 'New Delhi', population: 1380000000, gdp: 3737, government: 'Federal Parliamentary Republic', leader: 'Narendra Modi' },
  { name: 'United Kingdom', code: 'GB', continent: 'Europe', capital: 'London', population: 67000000, gdp: 3131, government: 'Constitutional Monarchy', leader: 'Rishi Sunak' },
  { name: 'France', code: 'FR', continent: 'Europe', capital: 'Paris', population: 68000000, gdp: 2937, government: 'Semi-Presidential Republic', leader: 'Emmanuel Macron' },
  { name: 'Italy', code: 'IT', continent: 'Europe', capital: 'Rome', population: 59000000, gdp: 2107, government: 'Parliamentary Republic', leader: 'Giorgia Meloni' },
  { name: 'Brazil', code: 'BR', continent: 'South America', capital: 'Brasília', population: 215000000, gdp: 2055, government: 'Federal Presidential Republic', leader: 'Luiz Inácio Lula da Silva' },
  { name: 'Canada', code: 'CA', continent: 'North America', capital: 'Ottawa', population: 38000000, gdp: 2140, government: 'Federal Parliamentary Democracy', leader: 'Justin Trudeau' },

  // 11-20
  { name: 'Russia', code: 'RU', continent: 'Europe', capital: 'Moscow', population: 146000000, gdp: 2240, government: 'Federal Semi-Presidential Republic', leader: 'Vladimir Putin' },
  { name: 'South Korea', code: 'KR', continent: 'Asia', capital: 'Seoul', population: 52000000, gdp: 1811, government: 'Presidential Republic', leader: 'Yoon Suk-yeol' },
  { name: 'Mexico', code: 'MX', continent: 'North America', capital: 'Mexico City', population: 128000000, gdp: 1688, government: 'Federal Presidential Republic', leader: 'Andrés Manuel López Obrador' },
  { name: 'Australia', code: 'AU', continent: 'Oceania', capital: 'Canberra', population: 26000000, gdp: 1553, government: 'Federal Parliamentary Democracy', leader: 'Anthony Albanese' },
  { name: 'Spain', code: 'ES', continent: 'Europe', capital: 'Madrid', population: 47000000, gdp: 1397, government: 'Constitutional Monarchy', leader: 'Pedro Sánchez' },
  { name: 'Indonesia', code: 'ID', continent: 'Asia', capital: 'Jakarta', population: 274000000, gdp: 1319, government: 'Presidential Republic', leader: 'Joko Widodo' },
  { name: 'Netherlands', code: 'NL', continent: 'Europe', capital: 'Amsterdam', population: 17000000, gdp: 909, government: 'Constitutional Monarchy', leader: 'Mark Rutte' },
  { name: 'Saudi Arabia', code: 'SA', continent: 'Asia', capital: 'Riyadh', population: 35000000, gdp: 833, government: 'Absolute Monarchy', leader: 'Mohammed bin Salman' },
  { name: 'Switzerland', code: 'CH', continent: 'Europe', capital: 'Bern', population: 9000000, gdp: 807, government: 'Federal Republic', leader: 'Viola Amherd' },
  { name: 'Taiwan', code: 'TW', continent: 'Asia', capital: 'Taipei', population: 24000000, gdp: 790, government: 'Semi-Presidential Republic', leader: 'Tsai Ing-wen' },

  // 21-30
  { name: 'Turkey', code: 'TR', continent: 'Asia', capital: 'Ankara', population: 84000000, gdp: 761, government: 'Presidential Republic', leader: 'Recep Tayyip Erdoğan' },
  { name: 'Belgium', code: 'BE', continent: 'Europe', capital: 'Brussels', population: 11000000, gdp: 529, government: 'Federal Parliamentary Democracy', leader: 'Alexander De Croo' },
  { name: 'Poland', code: 'PL', continent: 'Europe', capital: 'Warsaw', population: 38000000, gdp: 679, government: 'Parliamentary Republic', leader: 'Donald Tusk' },
  { name: 'Argentina', code: 'AR', continent: 'South America', capital: 'Buenos Aires', population: 45000000, gdp: 487, government: 'Federal Presidential Republic', leader: 'Javier Milei' },
  { name: 'Ireland', code: 'IE', continent: 'Europe', capital: 'Dublin', population: 5000000, gdp: 499, government: 'Parliamentary Republic', leader: 'Leo Varadkar' },
  { name: 'Israel', code: 'IL', continent: 'Asia', capital: 'Jerusalem', population: 9000000, gdp: 481, government: 'Parliamentary Republic', leader: 'Benjamin Netanyahu' },
  { name: 'Austria', code: 'AT', continent: 'Europe', capital: 'Vienna', population: 9000000, gdp: 477, government: 'Federal Parliamentary Republic', leader: 'Karl Nehammer' },
  { name: 'Thailand', code: 'TH', continent: 'Asia', capital: 'Bangkok', population: 70000000, gdp: 534, government: 'Constitutional Monarchy', leader: 'Srettha Thavisin' },
  { name: 'Nigeria', code: 'NG', continent: 'Africa', capital: 'Abuja', population: 218000000, gdp: 440, government: 'Federal Presidential Republic', leader: 'Bola Tinubu' },
  { name: 'Egypt', code: 'EG', continent: 'Africa', capital: 'Cairo', population: 104000000, gdp: 469, government: 'Presidential Republic', leader: 'Abdel Fattah el-Sisi' },

  // 31-40
  { name: 'United Arab Emirates', code: 'AE', continent: 'Asia', capital: 'Abu Dhabi', population: 10000000, gdp: 507, government: 'Federal Absolute Monarchy', leader: 'Mohammed bin Zayed' },
  { name: 'Malaysia', code: 'MY', continent: 'Asia', capital: 'Kuala Lumpur', population: 33000000, gdp: 432, government: 'Federal Constitutional Monarchy', leader: 'Anwar Ibrahim' },
  { name: 'South Africa', code: 'ZA', continent: 'Africa', capital: 'Cape Town', population: 60000000, gdp: 419, government: 'Parliamentary Republic', leader: 'Cyril Ramaphosa' },
  { name: 'Vietnam', code: 'VN', continent: 'Asia', capital: 'Hanoi', population: 98000000, gdp: 409, government: 'One-Party Socialist Republic', leader: 'Nguyễn Phú Trọng' },
  { name: 'Singapore', code: 'SG', continent: 'Asia', capital: 'Singapore', population: 6000000, gdp: 397, government: 'Parliamentary Republic', leader: 'Lawrence Wong' },
  { name: 'Philippines', code: 'PH', continent: 'Asia', capital: 'Manila', population: 110000000, gdp: 394, government: 'Presidential Republic', leader: 'Bongbong Marcos' },
  { name: 'Denmark', code: 'DK', continent: 'Europe', capital: 'Copenhagen', population: 6000000, gdp: 390, government: 'Constitutional Monarchy', leader: 'Mette Frederiksen' },
  { name: 'Bangladesh', code: 'BD', continent: 'Asia', capital: 'Dhaka', population: 165000000, gdp: 460, government: 'Parliamentary Republic', leader: 'Sheikh Hasina' },
  { name: 'Chile', code: 'CL', continent: 'South America', capital: 'Santiago', population: 19000000, gdp: 317, government: 'Presidential Republic', leader: 'Gabriel Boric' },
  { name: 'Finland', code: 'FI', continent: 'Europe', capital: 'Helsinki', population: 6000000, gdp: 297, government: 'Parliamentary Republic', leader: 'Petteri Orpo' },

  // 41-50
  { name: 'Romania', code: 'RO', continent: 'Europe', capital: 'Bucharest', population: 19000000, gdp: 284, government: 'Semi-Presidential Republic', leader: 'Marcel Ciolacu' },
  { name: 'Czech Republic', code: 'CZ', continent: 'Europe', capital: 'Prague', population: 11000000, gdp: 281, government: 'Parliamentary Republic', leader: 'Petr Fiala' },
  { name: 'New Zealand', code: 'NZ', continent: 'Oceania', capital: 'Wellington', population: 5000000, gdp: 249, government: 'Parliamentary Democracy', leader: 'Christopher Luxon' },
  { name: 'Portugal', code: 'PT', continent: 'Europe', capital: 'Lisbon', population: 10000000, gdp: 253, government: 'Semi-Presidential Republic', leader: 'António Costa' },
  { name: 'Peru', code: 'PE', continent: 'South America', capital: 'Lima', population: 33000000, gdp: 223, government: 'Presidential Republic', leader: 'Dina Boluarte' },
  { name: 'Iraq', code: 'IQ', continent: 'Asia', capital: 'Baghdad', population: 41000000, gdp: 264, government: 'Federal Parliamentary Republic', leader: 'Mohammed Shia al-Sudani' },
  { name: 'Greece', code: 'GR', continent: 'Europe', capital: 'Athens', population: 11000000, gdp: 189, government: 'Parliamentary Republic', leader: 'Kyriakos Mitsotakis' },
  { name: 'Kazakhstan', code: 'KZ', continent: 'Asia', capital: 'Nur-Sultan', population: 19000000, gdp: 220, government: 'Presidential Republic', leader: 'Kassym-Jomart Tokayev' },
  { name: 'Algeria', code: 'DZ', continent: 'Africa', capital: 'Algiers', population: 44000000, gdp: 191, government: 'Presidential Republic', leader: 'Abdelmadjid Tebboune' },
  { name: 'Qatar', code: 'QA', continent: 'Asia', capital: 'Doha', population: 3000000, gdp: 236, government: 'Absolute Monarchy', leader: 'Tamim bin Hamad Al Thani' },

  // 51-60
  { name: 'Hungary', code: 'HU', continent: 'Europe', capital: 'Budapest', population: 10000000, gdp: 181, government: 'Parliamentary Republic', leader: 'Viktor Orbán' },
  { name: 'Kuwait', code: 'KW', continent: 'Asia', capital: 'Kuwait City', population: 4000000, gdp: 175, government: 'Constitutional Monarchy', leader: 'Sabah Al-Ahmad Al-Jaber Al-Sabah' },
  { name: 'Morocco', code: 'MA', continent: 'Africa', capital: 'Rabat', population: 37000000, gdp: 132, government: 'Constitutional Monarchy', leader: 'Mohammed VI' },
  { name: 'Slovakia', code: 'SK', continent: 'Europe', capital: 'Bratislava', population: 5000000, gdp: 115, government: 'Parliamentary Republic', leader: 'Robert Fico' },
  { name: 'Kenya', code: 'KE', continent: 'Africa', capital: 'Nairobi', population: 54000000, gdp: 110, government: 'Presidential Republic', leader: 'William Ruto' },
  { name: 'Ethiopia', code: 'ET', continent: 'Africa', capital: 'Addis Ababa', population: 118000000, gdp: 111, government: 'Federal Parliamentary Republic', leader: 'Abiy Ahmed' },
  { name: 'Puerto Rico', code: 'PR', continent: 'North America', capital: 'San Juan', population: 3000000, gdp: 104, government: 'Commonwealth', leader: 'Pedro Pierluisi' },
  { name: 'Ecuador', code: 'EC', continent: 'South America', capital: 'Quito', population: 18000000, gdp: 106, government: 'Presidential Republic', leader: 'Daniel Noboa' },
  { name: 'Angola', code: 'AO', continent: 'Africa', capital: 'Luanda', population: 33000000, gdp: 124, government: 'Presidential Republic', leader: 'João Lourenço' },
  { name: 'Sri Lanka', code: 'LK', continent: 'Asia', capital: 'Colombo', population: 22000000, gdp: 84, government: 'Presidential Republic', leader: 'Ranil Wickremesinghe' },

  // 61-70
  { name: 'Dominican Republic', code: 'DO', continent: 'North America', capital: 'Santo Domingo', population: 11000000, gdp: 113, government: 'Presidential Republic', leader: 'Luis Abinader' },
  { name: 'Guatemala', code: 'GT', continent: 'North America', capital: 'Guatemala City', population: 17000000, gdp: 85, government: 'Presidential Republic', leader: 'Alejandro Giammattei' },
  { name: 'Oman', code: 'OM', continent: 'Asia', capital: 'Muscat', population: 5000000, gdp: 95, government: 'Absolute Monarchy', leader: 'Haitham bin Tariq' },
  { name: 'Panama', code: 'PA', continent: 'North America', capital: 'Panama City', population: 4000000, gdp: 75, government: 'Presidential Republic', leader: 'Laurentino Cortizo' },
  { name: 'Ghana', code: 'GH', continent: 'Africa', capital: 'Accra', population: 32000000, gdp: 77, government: 'Presidential Republic', leader: 'Nana Akufo-Addo' },
  { name: 'Croatia', code: 'HR', continent: 'Europe', capital: 'Zagreb', population: 4000000, gdp: 70, government: 'Parliamentary Republic', leader: 'Andrej Plenković' },
  { name: 'Tanzania', code: 'TZ', continent: 'Africa', capital: 'Dodoma', population: 61000000, gdp: 67, government: 'Presidential Republic', leader: 'Samia Suluhu Hassan' },
  { name: 'Uruguay', code: 'UY', continent: 'South America', capital: 'Montevideo', population: 3000000, gdp: 71, government: 'Presidential Republic', leader: 'Luis Lacalle Pou' },
  { name: 'Belarus', code: 'BY', continent: 'Europe', capital: 'Minsk', population: 9000000, gdp: 68, government: 'Presidential Republic', leader: 'Alexander Lukashenko' },
  { name: 'Costa Rica', code: 'CR', continent: 'North America', capital: 'San José', population: 5000000, gdp: 68, government: 'Presidential Republic', leader: 'Rodrigo Chaves' },

  // 71-80
  { name: 'Slovenia', code: 'SI', continent: 'Europe', capital: 'Ljubljana', population: 2000000, gdp: 61, government: 'Parliamentary Republic', leader: 'Golob Robert' },
  { name: 'Lithuania', code: 'LT', continent: 'Europe', capital: 'Vilnius', population: 3000000, gdp: 65, government: 'Parliamentary Republic', leader: 'Ingrida Šimonytė' },
  { name: 'Serbia', code: 'RS', continent: 'Europe', capital: 'Belgrade', population: 7000000, gdp: 63, government: 'Parliamentary Republic', leader: 'Aleksandar Vučić' },
  { name: 'Azerbaijan', code: 'AZ', continent: 'Asia', capital: 'Baku', population: 10000000, gdp: 54, government: 'Presidential Republic', leader: 'Ilham Aliyev' },
  { name: 'DR Congo', code: 'CD', continent: 'Africa', capital: 'Kinshasa', population: 95000000, gdp: 55, government: 'Presidential Republic', leader: 'Félix Tshisekedi' },
  { name: 'Myanmar', code: 'MM', continent: 'Asia', capital: 'Naypyidaw', population: 54000000, gdp: 65, government: 'Military Junta', leader: 'Min Aung Hlaing' },
  { name: 'Jordan', code: 'JO', continent: 'Asia', capital: 'Amman', population: 11000000, gdp: 48, government: 'Constitutional Monarchy', leader: 'Abdullah II' },
  { name: 'Tunisia', code: 'TN', continent: 'Africa', capital: 'Tunis', population: 12000000, gdp: 46, government: 'Presidential Republic', leader: 'Kais Saied' },
  { name: 'Bolivia', code: 'BO', continent: 'South America', capital: 'Sucre', population: 12000000, gdp: 43, government: 'Presidential Republic', leader: 'Luis Arce' },
  { name: 'Cameroon', code: 'CM', continent: 'Africa', capital: 'Yaoundé', population: 27000000, gdp: 45, government: 'Presidential Republic', leader: 'Paul Biya' },

  // 81-90
  { name: 'Bahrain', code: 'BH', continent: 'Asia', capital: 'Manama', population: 2000000, gdp: 44, government: 'Constitutional Monarchy', leader: 'Hamad bin Isa Al Khalifa' },
  { name: 'Latvia', code: 'LV', continent: 'Europe', capital: 'Riga', population: 2000000, gdp: 40, government: 'Parliamentary Republic', leader: 'Krišjānis Kariņš' },
  { name: 'Paraguay', code: 'PY', continent: 'South America', capital: 'Asunción', population: 7000000, gdp: 42, government: 'Presidential Republic', leader: 'Santiago Peña' },
  { name: 'Uganda', code: 'UG', continent: 'Africa', capital: 'Kampala', population: 47000000, gdp: 48, government: 'Presidential Republic', leader: 'Yoweri Museveni' },
  { name: 'Estonia', code: 'EE', continent: 'Europe', capital: 'Tallinn', population: 1000000, gdp: 38, government: 'Parliamentary Republic', leader: 'Kaja Kallas' },
  { name: 'Zambia', code: 'ZM', continent: 'Africa', capital: 'Lusaka', population: 19000000, gdp: 26, government: 'Presidential Republic', leader: 'Hakainde Hichilema' },
  { name: 'Honduras', code: 'HN', continent: 'North America', capital: 'Tegucigalpa', population: 10000000, gdp: 28, government: 'Presidential Republic', leader: 'Xiomara Castro' },
  { name: 'Nepal', code: 'NP', continent: 'Asia', capital: 'Kathmandu', population: 30000000, gdp: 40, government: 'Federal Parliamentary Republic', leader: 'Pushpa Kamal Dahal' },
  { name: 'Zimbabwe', code: 'ZW', continent: 'Africa', capital: 'Harare', population: 15000000, gdp: 31, government: 'Presidential Republic', leader: 'Emmerson Mnangagwa' },
  { name: 'Senegal', code: 'SN', continent: 'Africa', capital: 'Dakar', population: 17000000, gdp: 27, government: 'Presidential Republic', leader: 'Macky Sall' },

  // 91-100
  { name: 'Cambodia', code: 'KH', continent: 'Asia', capital: 'Phnom Penh', population: 17000000, gdp: 27, government: 'Constitutional Monarchy', leader: 'Hun Sen' },
  { name: 'Bosnia and Herzegovina', code: 'BA', continent: 'Europe', capital: 'Sarajevo', population: 3000000, gdp: 24, government: 'Federal Parliamentary Republic', leader: 'Borjana Krišto' },
  { name: 'Afghanistan', code: 'AF', continent: 'Asia', capital: 'Kabul', population: 39000000, gdp: 20, government: 'Islamic Emirate', leader: 'Hibatullah Akhundzada' },
  { name: 'Cyprus', code: 'CY', continent: 'Europe', capital: 'Nicosia', population: 1000000, gdp: 28, government: 'Presidential Republic', leader: 'Nikos Christodoulides' },
  { name: 'Georgia', code: 'GE', continent: 'Asia', capital: 'Tbilisi', population: 4000000, gdp: 24, government: 'Parliamentary Republic', leader: 'Irakli Garibashvili' },
  { name: 'Papua New Guinea', code: 'PG', continent: 'Oceania', capital: 'Port Moresby', population: 9000000, gdp: 25, government: 'Parliamentary Democracy', leader: 'James Marape' },
  { name: 'Mozambique', code: 'MZ', continent: 'Africa', capital: 'Maputo', population: 32000000, gdp: 16, government: 'Presidential Republic', leader: 'Filipe Nyusi' },
  { name: 'Botswana', code: 'BW', continent: 'Africa', capital: 'Gaborone', population: 2000000, gdp: 20, government: 'Parliamentary Republic', leader: 'Mokgweetsi Masisi' },
  { name: 'Jamaica', code: 'JM', continent: 'North America', capital: 'Kingston', population: 3000000, gdp: 17, government: 'Parliamentary Democracy', leader: 'Andrew Holness' },
  { name: 'Albania', code: 'AL', continent: 'Europe', capital: 'Tirana', population: 3000000, gdp: 18, government: 'Parliamentary Republic', leader: 'Edi Rama' },
  
  // Additional important countries
  { name: 'Sweden', code: 'SE', continent: 'Europe', capital: 'Stockholm', population: 10000000, gdp: 541, government: 'Constitutional Monarchy', leader: 'Ulf Kristersson' },
  { name: 'Norway', code: 'NO', continent: 'Europe', capital: 'Oslo', population: 5000000, gdp: 482, government: 'Constitutional Monarchy', leader: 'Jonas Gahr Støre' },
  { name: 'Luxembourg', code: 'LU', continent: 'Europe', capital: 'Luxembourg City', population: 600000, gdp: 86, government: 'Constitutional Monarchy', leader: 'Xavier Bettel' },
  { name: 'Iceland', code: 'IS', continent: 'Europe', capital: 'Reykjavik', population: 400000, gdp: 27, government: 'Parliamentary Republic', leader: 'Katrín Jakobsdóttir' },
  { name: 'Malta', code: 'MT', continent: 'Europe', capital: 'Valletta', population: 500000, gdp: 17, government: 'Parliamentary Republic', leader: 'Robert Abela' },
  { name: 'Colombia', code: 'CO', continent: 'South America', capital: 'Bogotá', population: 51000000, gdp: 314, government: 'Presidential Republic', leader: 'Gustavo Petro' },
  { name: 'Venezuela', code: 'VE', continent: 'South America', capital: 'Caracas', population: 28000000, gdp: 482, government: 'Presidential Republic', leader: 'Nicolás Maduro' },
  { name: 'Cuba', code: 'CU', continent: 'North America', capital: 'Havana', population: 11000000, gdp: 107, government: 'One-Party Socialist Republic', leader: 'Miguel Díaz-Canel' },
  { name: 'North Korea', code: 'KP', continent: 'Asia', capital: 'Pyongyang', population: 26000000, gdp: 40, government: 'One-Party Socialist Republic', leader: 'Kim Jong-un' },
  { name: 'Iran', code: 'IR', continent: 'Asia', capital: 'Tehran', population: 85000000, gdp: 231, government: 'Islamic Republic', leader: 'Ebrahim Raisi' },
  { name: 'Libya', code: 'LY', continent: 'Africa', capital: 'Tripoli', population: 7000000, gdp: 25, government: 'Transitional Government', leader: 'Abdul Hamid Dbeibeh' },
  { name: 'Sudan', code: 'SD', continent: 'Africa', capital: 'Khartoum', population: 45000000, gdp: 35, government: 'Military Government', leader: 'Abdel Fattah al-Burhan' }
];

async function populateCountries() {
  const dbManager = new DatabaseManager({
    path: './data/model-us-bot.db',
    enableWAL: true,
    enableForeignKeys: true
  }, logger);

  console.log('Populating international countries...');

  let added = 0;
  let skipped = 0;

  for (const country of countries) {
    const success = dbManager.createInternationalCountry(
      country.name,
      country.code,
      country.continent,
      '', // region
      country.capital,
      country.population,
      country.gdp,
      country.government,
      country.leader
    );

    if (success) {
      console.log(`✅ Added: ${country.name} (${country.code})`);
      added++;
    } else {
      console.log(`⚠️ Skipped: ${country.name} (${country.code}) - may already exist`);
      skipped++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`✅ Added: ${added} countries`);
  console.log(`⚠️ Skipped: ${skipped} countries`);
  console.log(`🌍 Total processed: ${countries.length} countries`);

  dbManager.close();
}

populateCountries().catch(console.error);