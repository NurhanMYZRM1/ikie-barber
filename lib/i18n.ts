import { ms as msLocale } from "date-fns/locale/ms";

// English text is the key; Malay lives in MS. Wrap every visible string in t() /
// translate(), including server and validation messages, which are translated where
// they are shown. tests/i18n.test.ts fails if a wrapped string has no Malay entry.
export type Lang = "en" | "ms";
export const LANG_COOKIE = "lang";
export type Translate = (text: string, vars?: Record<string, string | number>) => string;

export function translate(lang: Lang, text: string, vars?: Record<string, string | number>) {
  const template = lang === "ms" ? (MS[text] ?? text) : text;
  return vars
    ? template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`))
    : template;
}
export const dateLocale = (lang: Lang) => (lang === "ms" ? msLocale : undefined);

export const MS: Record<string, string> = {
  // Shared
  "Skip to content": "Langkau ke kandungan",
  "Good hair. Good mood. Anywhere.": "Rambut kemas. Hati ceria. Di mana-mana.",
  "Barber at the shop or house call in Putrajaya, Cyberjaya and Bangi. Book a time online.":
    "Gunting rambut di kedai atau servis ke rumah di Putrajaya, Cyberjaya dan Bangi. Tempah masa secara dalam talian.",
  Language: "Bahasa",
  "Loading your shop…": "Memuatkan kedai…",
  "Loading your workspace…": "Memuatkan ruang kerja anda…",
  Loading: "Memuatkan",
  "Page not found": "Halaman tidak dijumpai",
  "This link may have moved, or the date may not be valid.":
    "Pautan ini mungkin telah berubah, atau tarikh tidak sah.",
  "Back to the shop": "Kembali ke kedai",
  "This page couldn’t load": "Halaman ini tidak dapat dimuatkan",
  "Please check your connection and try again. If you’re setting up the shop, check the Supabase steps in the README.":
    "Sila semak sambungan anda dan cuba lagi. Jika anda sedang menyediakan kedai, semak langkah Supabase dalam README.",
  "Try again": "Cuba lagi",
  Monday: "Isnin",
  Tuesday: "Selasa",
  Wednesday: "Rabu",
  Thursday: "Khamis",
  Friday: "Jumaat",
  Saturday: "Sabtu",
  Sunday: "Ahad",
  "At the shop": "Di kedai",
  "at the shop": "di kedai",
  "{area} house call": "servis ke rumah {area}",
  Cancel: "Batal",
  "(optional)": "(pilihan)",
  Note: "Nota",
  "Saving…": "Menyimpan…",
  "This week": "Minggu ini",
  "This month": "Bulan ini",
  History: "Sejarah",
  "View your shop": "Lihat kedai anda",
  "Sign out": "Log keluar",
  "Check the highlighted fields.": "Semak ruangan yang ditandakan.",
  "Check the highlighted times.": "Semak masa yang ditandakan.",
  "Couldn’t save. Check your connection and try again.":
    "Tidak dapat disimpan. Semak sambungan anda dan cuba lagi.",
  "Couldn’t save. Please try again.": "Tidak dapat disimpan. Sila cuba lagi.",

  // Public page and status
  "Sample shop preview · Connect Supabase to make it yours.":
    "Pratonton kedai contoh · Sambungkan Supabase untuk jadikannya milik anda.",
  "{name} home": "Laman utama {name}",
  "Good hair.": "Rambut kemas.",
  "Good mood.": "Hati ceria.",
  "Anywhere.": "Di mana-mana.",
  "Book a time": "Tempah masa",
  "Not available until {date}": "Tidak tersedia sehingga {date}",
  "Not available until further notice": "Tidak tersedia sehingga diberitahu kelak",
  "On a break · Back at {time}": "Rehat · Kembali pukul {time}",
  "Open now · Closes {time}": "Buka sekarang · Tutup pukul {time}",
  "Closed · Opens today at {time}": "Tutup · Buka hari ini pukul {time}",
  "Closed · Opens tomorrow at {time}": "Tutup · Buka esok pukul {time}",
  "Closed · Opens {date} at {time}": "Tutup · Buka {date} pukul {time}",
  "Closed · Opening hours to be announced": "Tutup · Waktu buka akan dimaklumkan",

  // Design pass: public page and booking
  "Haircuts at the shop, or I come to you in Putrajaya, Cyberjaya and Bangi.":
    "Gunting rambut di kedai, atau saya datang ke rumah anda di Putrajaya, Cyberjaya dan Bangi.",
  "Full price list": "Senarai harga penuh",
  Prices: "Harga",
  "House call": "Servis ke rumah",
  "Online booking runs until midnight. For later times, ask on WhatsApp.":
    "Tempahan dalam talian dibuka hingga tengah malam. Untuk masa lebih lewat, tanya di WhatsApp.",
  "The exact address is shared after you book.": "Alamat penuh dikongsi selepas anda menempah.",
  "Booking is paused": "Tempahan ditutup sementara",
  "I’m not taking bookings right now. Message me on WhatsApp and I’ll reply when I’m back.":
    "Saya tidak menerima tempahan buat masa ini. Mesej saya di WhatsApp dan saya akan balas bila kembali.",
  "30-minute slots. Crossed-out times are taken.":
    "Slot 30 minit. Masa yang dipotong sudah ditempah.",
  "1. Date and time": "1. Tarikh dan masa",
  "Next 7 days": "7 hari akan datang",
  "{count} free": "{count} kosong",
  "Fully booked": "Penuh",
  "Selected {date} at {time}. Your details are next.":
    "Dipilih {date} pukul {time}. Seterusnya, isi butiran anda.",
  "2. Your details": "2. Butiran anda",
  "Your time": "Masa anda",
  "Change time": "Tukar masa",
  "Your time is saved. To change or cancel it, message me on WhatsApp.":
    "Masa anda sudah disimpan. Untuk tukar atau batal, mesej saya di WhatsApp.",
  When: "Bila",
  Name: "Nama",
  "I’ll come to you": "Saya datang ke rumah anda",

  // Design pass: owner screens
  Earnings: "Pendapatan",
  "Shop status": "Status kedai",
  "No earnings recorded in the last 7 days.": "Tiada pendapatan direkod dalam 7 hari lepas.",
  "Logo image URL (optional)": "URL imej logo (pilihan)",
  "Shown in your shop page header. Leave blank to use the Ikie Barber logo.":
    "Dipaparkan di bahagian atas halaman kedai. Biarkan kosong untuk guna logo Ikie Barber.",

  // Price list
  "Price list": "Senarai harga",
  "Base price": "Harga asas",
  Adult: "Dewasa",
  "{area} (house call)": "{area} (servis ke rumah)",
  "Extra charges": "Caj tambahan",
  "Late night (after 12 am)": "Lewat malam (selepas 12 tengah malam)",
  "Last minute / urgent": "Saat akhir / segera",
  "Price includes full equipment": "Harga termasuk peralatan lengkap",
  "Neat and professional service": "Servis kemas dan profesional",
  "Book early to secure a slot": "Tempah awal untuk dapatkan slot",
  "Prices may vary for some locations": "Harga boleh berubah mengikut lokasi tertentu",

  // Booking
  "At the shop · {base} / {adult}": "Di kedai · {base} / {adult}",
  "{area} house call · {price}": "Servis ke rumah {area} · {price}",
  "Hi {shop}, I've booked {date} at {time} ({area}). Name: {name}.":
    "Hai {shop}, saya sudah tempah {date} pukul {time} ({area}). Nama: {name}.",
  "Couldn’t send your booking. Check your connection and tap Book again.":
    "Tempahan tidak dapat dihantar. Semak sambungan anda dan tekan Tempah sekali lagi.",
  "You’re booked": "Tempahan berjaya",
  "Where to find me": "Lokasi saya",
  "I’ll send you the location on WhatsApp.": "Saya akan hantar lokasi melalui WhatsApp.",
  "Keep this page, or send me the details on WhatsApp so I can confirm.":
    "Simpan halaman ini, atau hantar butiran kepada saya melalui WhatsApp supaya saya boleh sahkan.",
  "Send me your booking details.": "Hantar butiran tempahan anda kepada saya.",
  "Send on WhatsApp": "Hantar melalui WhatsApp",
  "Choose your time": "Pilih masa anda",
  "Pick a date and an open slot, then book it. Grayed-out times are already taken.":
    "Pilih tarikh dan slot yang kosong, kemudian tempah. Masa berwarna kelabu sudah ditempah.",
  "Visit date": "Tarikh lawatan",
  "Available times": "Masa tersedia",
  "{time}, booked": "{time}, sudah ditempah",
  "No times to book on this date. Choose another day, or message me on WhatsApp.":
    "Tiada masa untuk ditempah pada tarikh ini. Pilih hari lain, atau mesej saya di WhatsApp.",
  "Times follow {timezone}.": "Masa mengikut {timezone}.",
  "{time} was just booked by someone else. Choose another time.":
    "{time} baru sahaja ditempah oleh orang lain. Pilih masa lain.",
  "Book {date} at {time}": "Tempah {date} pukul {time}",
  "Your name": "Nama anda",
  "WhatsApp number": "Nombor WhatsApp",
  Where: "Lokasi",
  "Your address": "Alamat anda",
  "Note (optional)": "Nota (pilihan)",
  "Kids cut, beard trim…": "Potong budak, trim janggut…",
  "No time picked yet": "Belum pilih masa",
  "Fill in your details, then book.": "Isi butiran anda, kemudian tempah.",
  "Pick a time above to book.": "Pilih masa di atas untuk menempah.",
  "Booking…": "Menempah…",
  "Book this time": "Tempah masa ini",
  "WhatsApp me": "WhatsApp saya",
  "Contact details coming soon": "Butiran hubungan akan dimaklumkan",
  "Booking is off in the sample preview.": "Tempahan dimatikan dalam pratonton contoh.",
  "That time isn’t available. Choose another.": "Masa itu tidak tersedia. Pilih masa lain.",
  "That time was just booked. Choose another.": "Masa itu baru sahaja ditempah. Pilih masa lain.",
  "Couldn’t save your booking. Please try again.": "Tempahan tidak dapat disimpan. Sila cuba lagi.",
  "You’re booked.": "Tempahan berjaya.",

  // Validation
  "Choose a time in 15-minute steps.": "Pilih masa dalam langkah 15 minit.",
  "Closing time must be after opening time.": "Waktu tutup mesti selepas waktu buka.",
  "The break must start and end inside opening hours.":
    "Waktu rehat mesti bermula dan tamat dalam waktu buka.",
  "Enter an amount with up to 2 decimal places.":
    "Masukkan jumlah dengan maksimum 2 tempat perpuluhan.",
  "Enter an amount greater than zero.": "Masukkan jumlah lebih daripada sifar.",
  "Enter your WhatsApp number, e.g. 0123456789.": "Masukkan nombor WhatsApp anda, cth. 0123456789.",
  "Enter your name.": "Masukkan nama anda.",
  "Enter your address for the house call.": "Masukkan alamat anda untuk servis ke rumah.",
  "Use a secure https:// link.": "Gunakan pautan https:// yang selamat.",
  "Enter your shop name.": "Masukkan nama kedai anda.",
  "Use country code and digits only, e.g. 60123456789.":
    "Gunakan kod negara dan digit sahaja, cth. 60123456789.",
  "Choose a valid IANA timezone, e.g. Asia/Kuala_Lumpur.":
    "Pilih zon waktu IANA yang sah, cth. Asia/Kuala_Lumpur.",

  // Owner login
  "Owner login": "Log masuk pemilik",
  "Bookings, hours and earnings.": "Tempahan, waktu dan pendapatan.",
  ID: "ID",
  Password: "Kata laluan",
  "Signing in…": "Sedang log masuk…",
  "Sign in": "Log masuk",
  "That ID or password isn’t right.": "ID atau kata laluan tidak betul.",
  "Owner login isn’t set up yet. Follow README.md to finish setup.":
    "Log masuk pemilik belum disediakan. Ikut README.md untuk selesaikan.",
  "Enter your ID and password.": "Masukkan ID dan kata laluan anda.",
  "This account isn’t the shop owner. Check the owner setup in the README.":
    "Akaun ini bukan pemilik kedai. Semak tetapan pemilik dalam README.",

  // Owner dashboard
  "Owner navigation": "Navigasi pemilik",
  Home: "Utama",
  Hours: "Waktu",
  Settings: "Tetapan",
  Today: "Hari ini",
  "View shop": "Lihat kedai",
  "Earnings summary": "Ringkasan pendapatan",
  "Today’s earnings": "Pendapatan hari ini",
  "Resets at midnight. Past days stay in History.":
    "Bermula semula pada tengah malam. Hari lepas kekal dalam Sejarah.",
  "Entries today": "Rekod hari ini",
  "Recorded today": "Direkod hari ini",
  "Today’s entries": "Rekod hari ini",
  "Tap an entry to edit or delete it.": "Tekan rekod untuk sunting atau padam.",
  "Add earnings": "Tambah pendapatan",
  "See earnings history": "Lihat sejarah pendapatan",
  "What your customers see": "Apa yang pelanggan anda lihat",
  "Edit entry": "Sunting rekod",
  "Close earnings form": "Tutup borang pendapatan",
  "Amount ({currency})": "Jumlah ({currency})",
  "Haircut + beard": "Gunting + janggut",
  "Payment method": "Kaedah bayaran",
  "Not specified": "Tidak dinyatakan",
  Cash: "Tunai",
  QR: "QR",
  Card: "Kad",
  "Save entry": "Simpan rekod",
  "Delete this earnings entry? This cannot be undone.":
    "Padam rekod pendapatan ini? Tindakan ini tidak boleh dibatalkan.",
  "Delete entry": "Padam rekod",
  "No earnings logged today. Tap + to add one.":
    "Belum ada pendapatan direkod hari ini. Tekan + untuk tambah.",
  "No entries for this day.": "Tiada rekod untuk hari ini.",
  "Edit {item}, {amount}": "Sunting {item}, {amount}",
  "earnings entry": "rekod pendapatan",
  "Earnings entry": "Rekod pendapatan",
  "Shop is available": "Kedai tersedia",
  "Shop is unavailable": "Kedai tidak tersedia",
  "Following your weekly opening hours": "Mengikut waktu buka mingguan anda",
  "Away mode overrides opening hours": "Mod cuti mengatasi waktu buka",
  "Back on {date}": "Kembali pada {date}",
  "Until further notice": "Sehingga diberitahu kelak",
  "Edit away details": "Sunting butiran cuti",
  "Let customers know you’re taking some time away.":
    "Beritahu pelanggan bahawa anda sedang bercuti.",
  "Back on": "Kembali pada",
  "Taking a short break. See you soon!": "Rehat sekejap. Jumpa lagi!",
  "Automatically available from midnight on your return date.":
    "Dibuka semula secara automatik pada tengah malam tarikh kembali anda.",
  "Set as unavailable": "Tetapkan tidak tersedia",
  "Weekly hours": "Waktu mingguan",
  "Closed all day": "Tutup sepanjang hari",
  "Open on {day}": "Buka pada hari {day}",
  From: "Dari",
  To: "Hingga",
  "Include a break": "Ada waktu rehat",
  "Break starts": "Rehat bermula",
  "Break ends": "Rehat tamat",
  "Save {day}": "Simpan {day}",
  "Opening hours": "Waktu buka",
  "Customers can book 30-minute slots inside these hours. A closing time of 12:00 AM means midnight.":
    "Pelanggan boleh menempah slot 30 minit dalam waktu ini. Waktu tutup 12:00 AM bermaksud tengah malam.",
  Change: "Tukar",
  "Tap a day to edit. Changes appear on your shop page as soon as you save. Overnight hours aren’t supported.":
    "Tekan hari untuk sunting. Perubahan dipaparkan di halaman kedai sebaik sahaja disimpan. Waktu melepasi tengah malam tidak disokong.",
  "Shop settings": "Tetapan kedai",
  "These details appear on your public page.": "Butiran ini dipaparkan di halaman awam anda.",
  "Shop profile": "Profil kedai",
  "A familiar face for your neighbourhood.": "Wajah yang dikenali di kawasan anda.",
  "Shop name": "Nama kedai",
  "Short description": "Penerangan ringkas",
  "Logo or shop photo URL": "URL logo atau gambar kedai",
  Address: "Alamat",
  "Google Maps link": "Pautan Google Maps",
  "Phone / WhatsApp number": "Nombor telefon / WhatsApp",
  "Include country code, with digits only. No +, spaces, or dashes.":
    "Sertakan kod negara, digit sahaja. Tanpa +, ruang atau sengkang.",
  "Local preferences": "Tetapan tempatan",
  "Shop timezone": "Zon waktu kedai",
  Currency: "Mata wang",
  "MYR — Malaysian ringgit (RM)": "MYR — Ringgit Malaysia (RM)",
  "SGD — Singapore dollar": "SGD — Dolar Singapura",
  "USD — US dollar": "USD — Dolar AS",
  "GBP — British pound": "GBP — Paun British",
  "EUR — Euro": "EUR — Euro",
  "AUD — Australian dollar": "AUD — Dolar Australia",
  "Choose these before your first entry. Changing timezone affects new entries only. Changing currency relabels all amounts; it does not convert them.":
    "Tetapkan ini sebelum rekod pertama anda. Menukar zon waktu hanya memberi kesan kepada rekod baharu. Menukar mata wang hanya menukar label jumlah; nilainya tidak ditukar.",
  "Save shop details": "Simpan butiran kedai",
  "Earnings history": "Sejarah pendapatan",
  "Daily totals for every day you’ve recorded earnings.":
    "Jumlah harian bagi setiap hari anda merekod pendapatan.",
  "The last 7 days": "7 hari lepas",
  "Past days": "Hari lepas",
  "View today": "Lihat hari ini",
  "1 entry": "1 rekod",
  "{count} entries": "{count} rekod",
  "No past earnings yet. Today’s entries will appear here after midnight.":
    "Belum ada pendapatan lepas. Rekod hari ini akan dipaparkan di sini selepas tengah malam.",
  "Weeks start on Monday. Dates follow {timezone}. Entries are kept when a new day starts.":
    "Minggu bermula hari Isnin. Tarikh mengikut {timezone}. Rekod kekal apabila hari baharu bermula.",
  "{count} entries · Tap to edit. Changes stay on this date.":
    "{count} rekod · Tekan untuk sunting. Perubahan kekal pada tarikh ini.",
  "Upcoming bookings": "Tempahan akan datang",
  Bookings: "Tempahan",
  "Past bookings": "Tempahan lepas",
  "No past bookings yet.": "Belum ada tempahan lepas.",
  "See all bookings": "Lihat semua tempahan",
  "Every customer booking. Cancel an upcoming one to free its slot.":
    "Semua tempahan pelanggan. Batalkan tempahan akan datang untuk mengosongkan slotnya.",
  "Showing the latest 200 past bookings.": "Memaparkan 200 tempahan lepas terkini.",
  "Cancel booking for {name}": "Batalkan tempahan {name}",
  "{app} directions to {name}": "Arah {app} ke {name}",
  "Cancel {name}’s booking? The slot becomes free.":
    "Batalkan tempahan {name}? Slot itu akan kosong semula.",
  "No upcoming bookings. They appear here as customers book.":
    "Tiada tempahan akan datang. Tempahan pelanggan akan dipaparkan di sini.",

  // Owner server messages
  "Couldn’t save hours. Please try again.": "Waktu tidak dapat disimpan. Sila cuba lagi.",
  "Opening hours saved.": "Waktu buka disimpan.",
  "Check your return date and note.": "Semak tarikh kembali dan nota anda.",
  "Couldn’t load the shop timezone. Try again.":
    "Zon waktu kedai tidak dapat dimuatkan. Cuba lagi.",
  "Choose a future return date, or leave it blank.":
    "Pilih tarikh kembali pada masa depan, atau biarkan kosong.",
  "Choose a date after today.": "Pilih tarikh selepas hari ini.",
  "Couldn’t update availability. Please try again.":
    "Status kedai tidak dapat dikemas kini. Sila cuba lagi.",
  "Your shop is available.": "Kedai anda kini tersedia.",
  "Away mode is on.": "Mod cuti dihidupkan.",
  "Invalid booking.": "Tempahan tidak sah.",
  "Couldn’t cancel the booking. Try again.": "Tempahan tidak dapat dibatalkan. Cuba lagi.",
  "Booking cancelled.": "Tempahan dibatalkan.",
  "Could not sign out. Please try again.": "Tidak dapat log keluar. Sila cuba lagi.",
  "Couldn’t update this entry. It may have been deleted.":
    "Rekod ini tidak dapat dikemas kini. Mungkin sudah dipadam.",
  "Couldn’t read the shop timezone. Please try again.":
    "Zon waktu kedai tidak dapat dibaca. Sila cuba lagi.",
  "Couldn’t save the entry. Please try again.": "Rekod tidak dapat disimpan. Sila cuba lagi.",
  "Entry updated.": "Rekod dikemas kini.",
  "Earnings added.": "Pendapatan ditambah.",
  "Invalid entry.": "Rekod tidak sah.",
  "Couldn’t delete the entry. Try again.": "Rekod tidak dapat dipadam. Cuba lagi.",
  "Entry deleted.": "Rekod dipadam.",
  "Couldn’t save your shop details. Please try again.":
    "Butiran kedai tidak dapat disimpan. Sila cuba lagi.",
  "Shop details saved.": "Butiran kedai disimpan.",
};
