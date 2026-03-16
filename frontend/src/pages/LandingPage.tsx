import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import cricketBatting from '../gallery/WhatsApp Image 2026-03-16 at 2.05.37 PM.jpeg';
import cricketFielding from '../gallery/WhatsApp Image 2026-03-15 at 5.49.32 PM.jpeg';
import cricketAction from '../gallery/WhatsApp Image 2026-03-15 at 5.49.33 PM.jpeg';
import appLogo from '../gallery/logo.png';
import actionDetectionIcon from '../gallery/icons/action detection .jpeg';
import techniqueAnalysisIcon from '../gallery/icons/Technique Analysis.jpeg';
import smartRecommendationIcon from '../gallery/icons/Smart Recomendation  (2).jpeg';
import performanceMetricsIcon from '../gallery/icons/Performance Metrices.jpeg';
import autoHighlightIcon from '../gallery/icons/AutoHighlight Generation .jpeg';
import noTimeIcon from '../gallery/icons/No Time For Video Analysis.jpeg';
import expensiveToolsIcon from '../gallery/icons/Expensive tools .jpeg';
import complexToUseIcon from '../gallery/icons/complex to use.jpeg';
import uploadVideoIcon from '../gallery/icons/Upload Video .jpeg';
import coachReviewIcon from '../gallery/icons/Coach Review.jpeg';
import reviewTimelineIcon from '../gallery/icons/Review Timeline .jpeg';
import getInsightsIcon from '../gallery/icons/Get insights .jpeg';

const translations: Record<string, Record<string, string>> = {
  en: {
    features: 'FEATURES',
    pricing: 'PRICING',
    about: 'WHO I AM',
    blog: 'BLOG',
    login: 'LOGIN',
    register: 'REGISTER',
    uploadYour: 'Upload.',
    cricketVideo: 'Get coached.',
    getCoach: 'Improve.',
    description: 'CricIQ let\'s you create, edit and share clips from any online video (YouTube, Twitch, ...)',
    registerBtn: 'REGISTER NOW FOR FREE',
    watchDemo: '▶ WATCH DEMO',
    heroDescription: 'CricIQ analyzes your bowling, batting and fielding videos to provide detailed performance insights, technique improvements, and match highlights- helping cricketers at all levels improve faster.',
    credits: '🎁 20 free credits when you sign up + 10 free credits every month',
    noSubs: 'No subscriptions • No commitments • Pay only when you need more',
    successStories: 'Success Stories',
    coachesImproving: 'Real Coaches, Real Results',
    successDesc: 'See how coaches like you are transforming their teams with CricIQ',
    limitedOffer: 'Limited Time Offer',
    joinNow: 'Join Now - Limited Spots',
    avgImprovement: 'Average Improvement',
    timesSaved: 'Hours Saved Per Week',
    coachesTransformed: 'Coaches Transformed',
    createEdit: 'CricIQ let\'s you create, edit and share clips from any online video (YouTube, Twitch, ...)',
    withEase: 'with ease. Perfect for scouting and analysis.',
    coaches: 'COACHES',
    clips: 'CLIPS',
    sports: 'SPORTS',
    powerfulFeatures: 'Powerful Features',
    uploadProcessing: 'Upload & Processing',
    uploadDesc: 'Upload your cricket training/match video and auto-organize key moments into clips',
    insights: 'Intelligent Feedback',
    insightsDesc: 'Receive real-time intelligent feedback on your performance with actionable improvement suggestions',
    dashboard: 'Dashboard & Reports',
    dashboardDesc: 'Weekly trends, performance analytics, and downloadable reports',
    howItWorks: 'How It Works',
    uploadVideo: 'Upload Video',
    uploadVideoDesc: 'Upload your cricket session video',
    detects: 'System Detects',
    detectsDesc: 'System identifies key cricket actions',
    reviewTimeline: 'Review Timeline',
    reviewDesc: 'Browse clips with timestamps',
    getInsights: 'Get Insights',
    getInsightsDesc: 'Receive feedback & performance summary',
    activeAthletes: 'Active Athletes',
    videosAnalyzed: 'Videos Analyzed',
    highlightsGenerated: 'Highlights Generated',
    coachesUsing: 'Coaches Using',
    readyToStart: 'Ready to get started?',
    createAccount: 'Create an account, upload cricket match videos, and let our system automatically detect key moments and generate highlight reels.',
    createAccountBtn: 'CREATE ACCOUNT',
    signIn: 'SIGN IN',
    copyright: '© 2024 CricIQ • Powered Cricket Highlight Generator'
  },
  es: {
    features: 'CARACTERÍSTICAS',
    pricing: 'PRECIOS',
    about: 'QUIÉN SOY',
    blog: 'BLOG',
    login: 'INICIAR SESIÓN',
    register: 'REGISTRARSE',
    uploadYour: 'Sube.',
    cricketVideo: 'Obtén entrenamiento.',
    getCoach: 'Mejora.',
    description: 'CricIQ te permite crear, editar y compartir clips de cualquier video en línea (YouTube, Twitch, ...)',
    registerBtn: 'REGÍSTRATE GRATIS AHORA',
    watchDemo: '▶ VER DEMOSTRACIÓN',
    heroDescription: 'CricIQ analiza tus videos de bowling, batting y fielding para proporcionar información detallada de rendimiento, mejoras de técnica y destacados de partidos, ayudando a jugadores de cricket de todos los niveles a mejorar más rápido.',
    credits: '🎁 20 créditos gratis al registrarse + 10 créditos gratis cada mes',
    noSubs: 'Sin suscripciones • Sin compromisos • Paga solo cuando necesites más',
    successStories: 'Historias de Éxito',
    coachesImproving: 'Entrenadores Reales, Resultados Reales',
    successDesc: 'Mira cómo entrenadores como tú están transformando sus equipos con CricIQ',
    limitedOffer: 'Oferta por Tiempo Limitado',
    joinNow: 'Únete Ahora - Lugares Limitados',
    avgImprovement: 'Mejora Promedio',
    timesSaved: 'Horas Ahorradas Por Semana',
    coachesTransformed: 'Entrenadores Transformados',
    createEdit: 'CricIQ te permite crear, editar y compartir clips de cualquier video en línea (YouTube, Twitch, ...)',
    withEase: 'con facilidad. Perfecto para scouting y análisis.',
    coaches: 'ENTRENADORES',
    clips: 'CLIPS',
    sports: 'DEPORTES',
    powerfulFeatures: 'Características Poderosas',
    uploadProcessing: 'Carga y Procesamiento',
    uploadDesc: 'Carga tu video de entrenamiento/partido de cricket y organiza automáticamente los momentos clave en clips',
    insights: 'Retroalimentación Inteligente',
    insightsDesc: 'Recibe retroalimentación inteligente en tiempo real sobre tu rendimiento con sugerencias de mejora accionables',
    dashboard: 'Panel y Reportes',
    dashboardDesc: 'Tendencias semanales, análisis de rendimiento e informes descargables',
    howItWorks: 'Cómo Funciona',
    uploadVideo: 'Cargar Video',
    uploadVideoDesc: 'Carga tu video de sesión de cricket',
    detects: 'Sistema Detecta',
    detectsDesc: 'El sistema identifica acciones clave de cricket',
    reviewTimeline: 'Revisar Línea de Tiempo',
    reviewDesc: 'Examina clips con marcas de tiempo',
    getInsights: 'Obtener Información',
    getInsightsDesc: 'Recibe retroalimentación y resumen de rendimiento',
    activeAthletes: 'Atletas Activos',
    videosAnalyzed: 'Videos Analizados',
    highlightsGenerated: 'Destacados Generados',
    coachesUsing: 'Entrenadores Usando',
    readyToStart: '¿Listo para comenzar?',
    createAccount: 'Crea una cuenta, carga videos de partidos de cricket y deja que nuestro sistema detecte automáticamente momentos clave y genere carretes destacados',
    createAccountBtn: 'CREAR CUENTA',
    signIn: 'INICIAR SESIÓN',
    copyright: '© 2024 CricIQ • Generador de Destacados de Cricket'
  },
  fr: {
    features: 'CARACTÉRISTIQUES',
    pricing: 'TARIFICATION',
    about: 'QUI SUIS-JE',
    blog: 'BLOG',
    login: 'CONNEXION',
    register: 'S\'INSCRIRE',
    uploadYour: 'Téléchargez.',
    cricketVideo: 'Obtenez un coaching.',
    getCoach: 'Améliorez-vous.',
    description: 'CricIQ vous permet de créer, modifier et partager des clips à partir de n\'importe quelle vidéo en ligne (YouTube, Twitch, ...)',
    registerBtn: 'S\'INSCRIRE GRATUITEMENT MAINTENANT',
    watchDemo: '▶ REGARDER LA DÉMO',
    heroDescription: 'CricIQ analyse vos vidéos de bowling, batting et fielding pour fournir des informations détaillées sur les performances, des améliorations techniques et des faits saillants de match, aidant les joueurs de cricket de tous les niveaux à s\'améliorer plus rapidement.',
    credits: '🎁 20 crédits gratuits à l\'inscription + 10 crédits gratuits chaque mois',
    noSubs: 'Pas d\'abonnements • Pas d\'engagements • Payez uniquement quand vous en avez besoin',
    successStories: 'Histoires de Succès',
    coachesImproving: 'Vrais Entraîneurs, Vrais Résultats',
    successDesc: 'Découvrez comment des entraîneurs comme vous transforment leurs équipes avec CricIQ',
    limitedOffer: 'Offre à Durée Limitée',
    joinNow: 'Rejoignez Maintenant - Places Limitées',
    avgImprovement: 'Amélioration Moyenne',
    timesSaved: 'Heures Économisées Par Semaine',
    coachesTransformed: 'Entraîneurs Transformés',
    createEdit: 'CricIQ vous permet de créer, modifier et partager des clips à partir de n\'importe quelle vidéo en ligne (YouTube, Twitch, ...)',
    withEase: 'facilement. Parfait pour le repérage et l\'analyse.',
    coaches: 'ENTRAÎNEURS',
    clips: 'CLIPS',
    sports: 'SPORTS',
    powerfulFeatures: 'Fonctionnalités Puissantes',
    uploadProcessing: 'Téléchargement et Traitement',
    uploadDesc: 'Téléchargez votre vidéo d\'entraînement/match de cricket et organisez automatiquement les moments clés en clips',
    insights: 'Retours Intelligents',
    insightsDesc: 'Recevez des retours intelligents en temps réel sur vos performances avec des suggestions d\'amélioration exploitables',
    dashboard: 'Tableau de Bord et Rapports',
    dashboardDesc: 'Tendances hebdomadaires, analyses de performance et rapports téléchargeables',
    howItWorks: 'Comment Ça Marche',
    uploadVideo: 'Télécharger une Vidéo',
    uploadVideoDesc: 'Téléchargez votre vidéo de session de cricket',
    detects: 'Système Détecte',
    detectsDesc: 'Le système identifie les actions clés du cricket',
    reviewTimeline: 'Examiner la Chronologie',
    reviewDesc: 'Parcourez les clips avec des horodatages',
    getInsights: 'Obtenir des Informations',
    getInsightsDesc: 'Recevez des retours et un résumé des performances',
    activeAthletes: 'Athlètes Actifs',
    videosAnalyzed: 'Vidéos Analysées',
    highlightsGenerated: 'Faits Saillants Générés',
    coachesUsing: 'Entraîneurs Utilisant',
    readyToStart: 'Prêt à commencer?',
    createAccount: 'Créez un compte, téléchargez des vidéos de matchs de cricket et laissez notre système détecter automatiquement les moments clés et générer des bobines en vedette',
    createAccountBtn: 'CRÉER UN COMPTE',
    signIn: 'SE CONNECTER',
    copyright: '© 2024 CricIQ • Générateur de Faits Saillants de Cricket'
  },
  de: {
    features: 'FUNKTIONEN',
    pricing: 'PREISGESTALTUNG',
    about: 'WER BIN ICH',
    blog: 'BLOG',
    login: 'ANMELDEN',
    register: 'REGISTRIEREN',
    uploadYour: 'Hochladen.',
    cricketVideo: 'Erhalten Sie Coaching.',
    getCoach: 'Verbessern Sie sich.',
    description: 'CricIQ ermöglicht es Ihnen, Clips aus jedem Online-Video (YouTube, Twitch, ...) zu erstellen, zu bearbeiten und zu teilen',
    registerBtn: 'JETZT KOSTENLOS REGISTRIEREN',
    watchDemo: '▶ DEMO ANSEHEN',
    heroDescription: 'CricIQ analysiert Ihre Bowling-, Batting- und Fielding-Videos, um detaillierte Leistungseinblicke, Technikverbesserungen und Match-Highlights bereitzustellen und Cricketspielern aller Niveaus zu helfen, schneller zu verbessern.',
    credits: '🎁 20 kostenlose Credits bei der Anmeldung + 10 kostenlose Credits jeden Monat',
    noSubs: 'Keine Abos • Keine Verpflichtungen • Zahlen Sie nur, wenn Sie mehr benötigen',
    successStories: 'Erfolgsgeschichten',
    coachesImproving: 'Echte Trainer, Echte Ergebnisse',
    successDesc: 'Sehen Sie, wie Trainer wie Sie ihre Teams mit CricIQ transformieren',
    limitedOffer: 'Zeitlich Begrenztes Angebot',
    joinNow: 'Jetzt Beitreten - Begrenzte Plätze',
    avgImprovement: 'Durchschnittliche Verbesserung',
    timesSaved: 'Stunden Pro Woche Gespart',
    coachesTransformed: 'Trainer Transformiert',
    createEdit: 'CricIQ ermöglicht es Ihnen, Clips aus jedem Online-Video (YouTube, Twitch, ...) zu erstellen, zu bearbeiten und zu teilen',
    withEase: 'mit Leichtigkeit. Perfekt zum Scouting und zur Analyse.',
    coaches: 'TRAINER',
    clips: 'CLIPS',
    sports: 'SPORTARTEN',
    powerfulFeatures: 'Leistungsstarke Funktionen',
    uploadProcessing: 'Upload und Verarbeitung',
    uploadDesc: 'Laden Sie Ihr Cricket-Trainings-/Matchvideo hoch und organisieren Sie automatisch wichtige Momente in Clips',
    insights: 'Intelligentes Feedback',
    insightsDesc: 'Erhalten Sie intelligentes Echtzeit-Feedback zu Ihrer Leistung mit umsetzbaren Verbesserungsvorschlägen',
    dashboard: 'Dashboard und Berichte',
    dashboardDesc: 'Wöchentliche Trends, Leistungsanalysen und herunterladbare Berichte',
    howItWorks: 'Wie es funktioniert',
    uploadVideo: 'Video hochladen',
    uploadVideoDesc: 'Laden Sie Ihr Cricket-Sitzungsvideo hoch',
    detects: 'System erkennt',
    detectsDesc: 'Das System identifiziert wichtige Cricket-Aktionen',
    reviewTimeline: 'Zeitleiste überprüfen',
    reviewDesc: 'Durchsuchen Sie Clips mit Zeitstempeln',
    getInsights: 'Erkenntnisse erhalten',
    getInsightsDesc: 'Erhalten Sie Feedback und eine Leistungszusammenfassung',
    activeAthletes: 'Aktive Athleten',
    videosAnalyzed: 'Analysierte Videos',
    highlightsGenerated: 'Generierte Highlights',
    coachesUsing: 'Trainer verwenden',
    readyToStart: 'Bereit zum Starten?',
    createAccount: 'Erstellen Sie ein Konto, laden Sie Cricket-Match-Videos hoch und lassen Sie unser System automatisch wichtige Momente erkennen und Highlight-Reels generieren',
    createAccountBtn: 'KONTO ERSTELLEN',
    signIn: 'ANMELDEN',
    copyright: '© 2024 CricIQ • Cricket-Highlight-Generator'
  },
  hi: {
    features: 'विशेषताएं',
    pricing: 'मूल्य निर्धारण',
    about: 'मैं कौन हूँ',
    blog: 'ब्लॉग',
    login: 'लॉगिन',
    register: 'पंजीकरण',
    uploadYour: 'अपलोड करें।',
    cricketVideo: 'कोचिंग प्राप्त करें।',
    getCoach: 'सुधार करें।',
    description: 'CricIQ आपको किसी भी ऑनलाइन वीडियो (YouTube, Twitch, ...) से क्लिप बनाने, संपादित करने और साझा करने देता है',
    registerBtn: 'अभी मुफ्त में पंजीकरण करें',
    watchDemo: '▶ डेमो देखें',
    heroDescription: 'CricIQ आपकी बॉलिंग, बैटिंग और फील्डिंग वीडियो का विश्लेषण करता है ताकि विस्तृत प्रदर्शन अंतर्दृष्टि, तकनीक सुधार और मैच हाइलाइट प्रदान किए जा सकें, जो सभी स्तरों के क्रिकेटरों को तेजी से सुधार करने में मदद करता है।',
    credits: '🎁 साइन अप करने पर 20 मुफ्त क्रेडिट + हर महीने 10 मुफ्त क्रेडिट',
    noSubs: 'कोई सदस्यता नहीं • कोई प्रतिबद्धता नहीं • केवल तभी भुगतान करें जब आपको अधिक की आवश्यकता हो',
    successStories: 'सफलता की कहानियां',
    coachesImproving: 'असली कोच, असली परिणाम',
    successDesc: 'देखें कि आपके जैसे कोच CricIQ के साथ अपनी टीमों को कैसे बदल रहे हैं',
    limitedOffer: 'सीमित समय का प्रस्ताव',
    joinNow: 'अभी शामिल हों - सीमित स्थान',
    avgImprovement: 'औसत सुधार',
    timesSaved: 'प्रति सप्ताह घंटे बचाए गए',
    coachesTransformed: 'कोच रूपांतरित',
    createEdit: 'CricIQ आपको किसी भी ऑनलाइन वीडियो (YouTube, Twitch, ...) से क्लिप बनाने, संपादित करने और साझा करने देता है',
    withEase: 'आसानी से। स्काउटिंग और विश्लेषण के लिए बिल्कुल सही।',
    coaches: 'कोच',
    clips: 'क्लिप',
    sports: 'खेल',
    powerfulFeatures: 'शक्तिशाली विशेषताएं',
    uploadProcessing: 'अपलोड और प्रसंस्करण',
    uploadDesc: 'अपनी क्रिकेट प्रशिक्षण/मैच वीडियो अपलोड करें और मुख्य क्षणों को स्वचालित रूप से क्लिप में व्यवस्थित करें',
    insights: 'बुद्धिमान प्रतिक्रिया',
    insightsDesc: 'अपने प्रदर्शन पर रीयल-टाइम बुद्धिमान प्रतिक्रिया प्राप्त करें और कार्यान्वयन योग्य सुधार सुझाव',
    dashboard: 'डैशबोर्ड और रिपोर्ट',
    dashboardDesc: 'साप्ताहिक प्रवृत्तियां, प्रदर्शन विश्लेषण और डाउनलोड योग्य रिपोर्ट',
    howItWorks: 'यह कैसे काम करता है',
    uploadVideo: 'वीडियो अपलोड करें',
    uploadVideoDesc: 'अपनी क्रिकेट सत्र वीडियो अपलोड करें',
    detects: 'सिस्टम का पता लगाता है',
    detectsDesc: 'सिस्टम मुख्य क्रिकेट क्रियाओं की पहचान करता है',
    reviewTimeline: 'समयरेखा की समीक्षा करें',
    reviewDesc: 'टाइमस्टैम्प के साथ क्लिप ब्राउज़ करें',
    getInsights: 'अंतर्दृष्टि प्राप्त करें',
    getInsightsDesc: 'प्रतिक्रिया और प्रदर्शन सारांश प्राप्त करें',
    activeAthletes: 'सक्रिय एथलीट',
    videosAnalyzed: 'विश्लेषण किए गए वीडियो',
    highlightsGenerated: 'उत्पन्न हाइलाइट्स',
    coachesUsing: 'कोच उपयोग कर रहे हैं',
    readyToStart: 'शुरू करने के लिए तैयार?',
    createAccount: 'एक खाता बनाएं, क्रिकेट मैच वीडियो अपलोड करें, और हमारे सिस्टम को स्वचालित रूप से मुख्य क्षणों का पता लगाने और हाइलाइट रील उत्पन्न करने दें।',
    createAccountBtn: 'खाता बनाएं',
    signIn: 'साइन इन करें',
    copyright: '© 2024 CricIQ • क्रिकेट हाइलाइट जनरेटर'
  }
};

export default function LandingPage() {
  const [language, setLanguage] = useState('en');
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: 'Hi! 👋 How can I help you today?', sender: 'bot', timestamp: new Date() }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [email, setEmail] = useState('');
  const t = translations[language];

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      alert('Thanks for subscribing! Check your email for updates.');
      setEmail('');
    }
  };

  const chatResponses: Record<string, Record<string, string>> = {
    en: {
      pricing: 'We offer pay-as-you-go pricing. Start with 20 free credits, then pay only for what you use. No subscriptions!',
      features: 'CricIQ offers Action Detection, Technique Analysis, Smart Recommendations, Performance Metrics, and Auto Highlight Generation.',
      free: 'Yes! You get 20 free credits when you sign up, plus 10 free credits every month.',
      support: 'Our support team is available 24/7. You can also email us at support@CricIQ.com',
      demo: 'You can watch our demo video by clicking the "Watch Demo" button on the page!',
      signup: 'Ready to get started? Click the "Register Now" button to create your free account!',
      default: 'Great question! Feel free to ask me about pricing, features, or how to get started. 😊'
    },
    es: {
      pricing: 'Ofrecemos precios de pago por uso. Comienza con 20 créditos gratis, luego paga solo por lo que uses. ¡Sin suscripciones!',
      features: 'CricIQ ofrece Detección de Acciones, Análisis de Técnica, Recomendaciones Inteligentes, Métricas de Rendimiento y Generación Automática de Destacados.',
      free: '¡Sí! Obtienes 20 créditos gratis al registrarte, más 10 créditos gratis cada mes.',
      support: 'Nuestro equipo de soporte está disponible 24/7. ¡También puedes enviarnos un correo electrónico!',
      demo: '¡Puedes ver nuestro video de demostración haciendo clic en el botón "Ver Demostración" en la página!',
      signup: '¿Listo para comenzar? ¡Haz clic en el botón "Registrarse Ahora" para crear tu cuenta gratuita!',
      default: '¡Gran pregunta! Siéntete libre de preguntarme sobre precios, características o cómo comenzar. 😊'
    },
    fr: {
      pricing: 'Nous proposons une tarification à l\'usage. Commencez avec 20 crédits gratuits, puis payez uniquement ce que vous utilisez. Pas d\'abonnements!',
      features: 'CricIQ offre la Détection d\'Actions, l\'Analyse de Technique, les Recommandations Intelligentes, les Métriques de Performance et la Génération Automatique de Faits Saillants.',
      free: 'Oui! Vous obtenez 20 crédits gratuits lors de l\'inscription, plus 10 crédits gratuits chaque mois.',
      support: 'Notre équipe d\'assistance est disponible 24h/24, 7j/7. Vous pouvez aussi nous envoyer un email!',
      demo: 'Vous pouvez regarder notre vidéo de démonstration en cliquant sur le bouton "Regarder la Démo" sur la page!',
      signup: 'Prêt à commencer? Cliquez sur le bouton "S\'inscrire Maintenant" pour créer votre compte gratuit!',
      default: 'Excellente question! N\'hésitez pas à me poser des questions sur les tarifs, les fonctionnalités ou comment commencer. 😊'
    },
    de: {
      pricing: 'Wir bieten Pay-as-you-go-Preise. Beginnen Sie mit 20 kostenlosen Credits und zahlen Sie dann nur für das, was Sie verwenden. Keine Abos!',
      features: 'CricIQ bietet Aktionserkennung, Technikanalyse, intelligente Empfehlungen, Leistungsmetriken und automatische Highlight-Generierung.',
      free: 'Ja! Sie erhalten 20 kostenlose Credits bei der Anmeldung plus 10 kostenlose Credits jeden Monat.',
      support: 'Unser Support-Team ist 24/7 verfügbar. Sie können uns auch eine E-Mail senden!',
      demo: 'Sie können unser Demo-Video ansehen, indem Sie auf der Seite auf die Schaltfläche "Demo ansehen" klicken!',
      signup: 'Bereit zum Starten? Klicken Sie auf die Schaltfläche "Jetzt registrieren", um Ihr kostenloses Konto zu erstellen!',
      default: 'Großartig! Fragen Sie mich gerne nach Preisen, Funktionen oder wie Sie anfangen können. 😊'
    },
    hi: {
      pricing: 'हम पे-एज-यू-गो मूल्य निर्धारण प्रदान करते हैं। 20 मुफ्त क्रेडिट के साथ शुरू करें, फिर केवल जो आप उपयोग करते हैं उसके लिए भुगतान करें। कोई सदस्यता नहीं!',
      features: 'CricIQ एक्शन डिटेक्शन, तकनीक विश्लेषण, स्मार्ट सिफारिशें, प्रदर्शन मेट्रिक्स और ऑटो हाइलाइट जनरेशन प्रदान करता है।',
      free: 'हाँ! आपको साइन अप करने पर 20 मुफ्त क्रेडिट मिलते हैं, साथ ही हर महीने 10 मुफ्त क्रेडिट।',
      support: 'हमारी सहायता टीम 24/7 उपलब्ध है। आप हमें ईमेल भी कर सकते हैं!',
      demo: 'आप पृष्ठ पर "डेमो देखें" बटन पर क्लिक करके हमारा डेमो वीडियो देख सकते हैं!',
      signup: 'शुरू करने के लिए तैयार? अपना मुफ्त खाता बनाने के लिए "अभी पंजीकरण करें" बटन पर क्लिक करें!',
      default: 'बहुत अच्छा सवाल! मुझसे मूल्य निर्धारण, सुविधाओं या कैसे शुरू करें के बारे में पूछने में संकोच न करें। 😊'
    }
  };

  const getBotResponse = (userMessage: string) => {
    const msg = userMessage.toLowerCase();
    const responses = chatResponses[language] || chatResponses['en'];

    if (msg.includes('price') || msg.includes('cost') || msg.includes('pricing')) {
      return responses.pricing;
    } else if (msg.includes('feature') || msg.includes('what can')) {
      return responses.features;
    } else if (msg.includes('free') || msg.includes('credit')) {
      return responses.free;
    } else if (msg.includes('support') || msg.includes('help') || msg.includes('contact')) {
      return responses.support;
    } else if (msg.includes('demo')) {
      return responses.demo;
    } else if (msg.includes('sign') || msg.includes('register') || msg.includes('start')) {
      return responses.signup;
    } else {
      return responses.default;
    }
  };

  const handleSendMessage = () => {
    if (inputValue.trim() === '') return;

    const userMessage = {
      id: messages.length + 1,
      text: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages([...messages, userMessage]);
    setInputValue('');

    setTimeout(() => {
      const botMessage = {
        id: messages.length + 2,
        text: getBotResponse(inputValue),
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);
    }, 500);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden">
      {/* Animated Background Pattern */}
      <div className="fixed inset-0 opacity-5 pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-transparent to-blue-500" style={{ animation: 'float 20s ease-in-out infinite' }}></div>
      </div>
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur border-b border-slate-700 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex items-center justify-between h-16">
            <motion.div whileHover={{ scale: 1.05 }}>
              <Link to="/" className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg overflow-hidden hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300">
                  <img src={appLogo} alt="CricIQ Logo" className="w-full h-full object-cover" />
                </div>
                <span className="text-xl font-bold text-white">CricIQ</span>
              </Link>
            </motion.div>

            <nav className="hidden md:flex items-center gap-4 lg:gap-8">
              {['Features', 'Testimonials', 'Pricing', 'Articles', 'FAQ'].map((item, i) => (
                <motion.div key={i} whileHover={{ y: -2 }}>
                  <a
                    href={item === 'FAQ' ? '#faq' : item === 'Features' ? '#features' : item === 'Testimonials' ? '#testimonials' : item === 'Pricing' ? '#pricing' : '#'}
                    onClick={(e: React.MouseEvent) => {
                      if (item === 'FAQ' || item === 'Features' || item === 'Testimonials' || item === 'Pricing') {
                        e.preventDefault();
                        const element = document.getElementById(item.toLowerCase());
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth' });
                        }
                      }
                    }}
                    className="text-gray-300 hover:text-white transition text-xs sm:text-sm font-medium relative group cursor-pointer"
                  >
                    {item}
                    <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-400 to-purple-500 group-hover:w-full transition-all duration-300"></span>
                  </a>
                </motion.div>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-4">
              <select 
                value={language} 
                onChange={(e) => setLanguage(e.target.value)}
                className="text-gray-300 text-sm font-medium bg-transparent border-b-2 border-slate-600 focus:outline-none cursor-pointer hover:border-purple-500 transition-colors"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="hi">हिन्दी</option>
              </select>
              <motion.div whileHover={{ scale: 1.05 }}>
                <Link to="/login" className="text-gray-300 hover:text-white transition text-sm font-medium border-b-2 border-slate-600 pb-1 hover:border-purple-500">{t.login}</Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link to="/register" className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold text-sm rounded transition shadow-lg hover:shadow-xl">{t.register}</Link>
              </motion.div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 animate-pulse"></div>
        
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white leading-tight mb-4 sm:mb-6">
                {t.uploadYour}
                <br />
                {t.cricketVideo}
                <br />
                <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">{t.getCoach}</span>
              </h1>

              <p className="text-sm sm:text-base md:text-lg text-gray-300 mb-6 sm:mb-8">
                {t.heroDescription}
              </p>

              {/* Trust Badge */}
              <div className="mb-8 inline-flex items-center gap-2 bg-slate-800/50 border border-slate-700 rounded-full px-4 py-2">
                <span className="text-green-400 font-bold">✓</span>
                <span className="text-sm text-gray-300">Trusted by 1500+ coaches worldwide</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative"
                >
                  <Link to="/register" className="px-6 sm:px-8 py-2 sm:py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold text-xs sm:text-sm rounded transition text-center shadow-lg hover:shadow-xl relative overflow-hidden group">
                    <span className="relative z-10">{t.registerBtn}</span>
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                  </Link>
                  <motion.div 
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -top-3 -right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full"
                  >
                    ⚡ {t.limitedOffer}
                  </motion.div>
                </motion.div>
                <motion.button 
                  onClick={() => setShowDemoModal(true)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 sm:px-8 py-2 sm:py-3 border-2 border-purple-500 text-purple-400 hover:bg-purple-500/10 font-bold text-xs sm:text-sm rounded transition flex items-center justify-center gap-2 group"
                >
                  {t.watchDemo}
                  <motion.span
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    ▶
                  </motion.span>
                </motion.button>
              </div>


            </motion.div>

            {/* Right - Product Mockup */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative hidden lg:block"
            >
              <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border-8 border-black hover:shadow-purple-500/50 transition-shadow duration-300" style={{ boxShadow: '0 0 40px rgba(168, 85, 247, 0.3)' }}>
                <img
                  src={cricketBatting}
                  alt="Cricket batting"
                  className="w-full h-96 object-cover"
                />
              </div>

              <div className="mt-4 flex gap-4">
                <div className="flex-1 bg-white rounded-lg shadow-lg border-4 border-black h-24 overflow-hidden hover:shadow-purple-500/30 transition-shadow duration-300" style={{ boxShadow: '0 0 20px rgba(168, 85, 247, 0.2)' }}>
                  <img
                    src={cricketFielding}
                    alt="Cricket fielding"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 bg-white rounded-lg shadow-lg border-4 border-black h-24 overflow-hidden hover:shadow-purple-500/30 transition-shadow duration-300" style={{ boxShadow: '0 0 20px rgba(168, 85, 247, 0.2)' }}>
                  <img
                    src={cricketAction}
                    alt="Cricket action"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Description & Stats Section */}
      <section className="bg-slate-800/50 py-16 px-4 relative">
        {/* Section Divider */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent"></div>
        
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Left - Description */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <p className="text-lg text-gray-300">
                <span className="font-semibold text-white">CricIQ</span> {t.createEdit}
              </p>
              <p className="text-lg text-gray-300 mt-2">
                {t.withEase}
              </p>
            </motion.div>

            {/* Right - Stats */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="grid grid-cols-3 gap-8 text-center"
            >
              <div>
                <motion.div 
                  initial={{ scale: 0.8 }}
                  whileInView={{ scale: 1 }}
                  transition={{ duration: 0.5 }}
                  viewport={{ once: true }}
                  className="text-4xl font-black bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">1500+</motion.div>
                <p className="text-gray-300 font-medium text-sm mt-2">{t.coaches}</p>
              </div>
              <div>
                <motion.div 
                  initial={{ scale: 0.8 }}
                  whileInView={{ scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  viewport={{ once: true }}
                  className="text-4xl font-black bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">8600+</motion.div>
                <p className="text-gray-300 font-medium text-sm mt-2">{t.clips}</p>
              </div>
              <div>
                <motion.div 
                  initial={{ scale: 0.8 }}
                  whileInView={{ scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  viewport={{ once: true }}
                  className="text-4xl font-black bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">10+</motion.div>
                <p className="text-gray-300 font-medium text-sm mt-2">{t.sports}</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Problems Section */}
      <section className="py-20 px-4 bg-slate-900 relative">
        {/* Section Divider */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent"></div>
        
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-black text-white text-center mb-6">
              Do these problems sound familiar to you?
            </h2>
            <p className="text-lg text-gray-300 text-center mb-16">
              You don't need the same tools used by professional teams. You need something effective, accessible, and that adapts to your pace. CricIQ is designed exactly for that: real coaches, with real budgets, who want real results.
            </p>
          </motion.div>

          <div className="space-y-8">
            {[
              {
                icon: noTimeIcon,
                title: 'No time for video analysis?',
                desc: 'As an amateur coach, you know your time is gold. Preparing video analysis would mean sacrificing valuable hours of technical and tactical training.',
                cta: 'OPTIMIZE YOUR TIME'
              },
              {
                icon: expensiveToolsIcon,
                title: 'Expensive tools?',
                desc: 'Professional video analysis software costs thousands. CricIQ provides enterprise-level analysis at a fraction of the cost.'
              },
              {
                icon: complexToUseIcon,
                title: 'Complex to use?',
                desc: 'Most tools require technical expertise. Our platform is intuitive and designed for coaches, not tech experts.'
              }
            ].map((problem, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
                viewport={{ once: true }}
                className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 hover:border-purple-500 hover:bg-slate-800/70 transition-all duration-300"
              >
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <img src={problem.icon} alt={problem.title} className="w-10 h-10 object-contain" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-white mb-3">{problem.title}</h3>
                    <p className="text-gray-300 mb-4">{problem.desc}</p>
                    {problem.cta && (
                      <Link to="/register" className="px-6 py-2 border-2 border-purple-500 text-purple-400 hover:bg-purple-500/10 font-bold rounded transition inline-block">
                        {problem.cta} →
                      </Link>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-slate-800/50 relative">
        {/* Section Divider */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent"></div>
        
        <div className="max-w-6xl mx-auto">
          <motion.h2 
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-black text-white text-center mb-12"
          >
            {t.powerfulFeatures}
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: actionDetectionIcon,
                title: 'Action Detection',
                desc: 'Automatically detect batting, bowling, and fielding actions with 98% accuracy using advanced machine learning'
              },
              {
                icon: techniqueAnalysisIcon,
                title: 'Technique Analysis',
                desc: 'Analyzes your technique with 94% accuracy and provides detailed biomechanical insights for improvement'
              },
              {
                icon: smartRecommendationIcon,
                title: 'Smart Recommendations',
                desc: 'Get personalized coaching recommendations based on performance analysis'
              },
              {
                icon: performanceMetricsIcon,
                title: 'Performance Metrics',
                desc: 'Generates comprehensive performance metrics and trends for continuous improvement'
              },
              {
                icon: autoHighlightIcon,
                title: 'Auto Highlight Generation',
                desc: 'Automatically create highlight reels from your videos using intelligent scene detection'
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
                className="p-6 border-2 border-slate-600 rounded-lg hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-300 bg-slate-700/30 group"
              >
                <motion.div 
                  whileHover={{ scale: 1.1 }}
                  className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4 mx-auto group-hover:shadow-lg group-hover:shadow-purple-500/50 transition-all duration-300"
                >
                  <img src={feature.icon} alt={feature.title} className="w-12 h-12 object-contain" />
                </motion.div>
                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-300">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link to="/features-detail" className="px-6 py-2 border-2 border-purple-500 text-purple-400 hover:bg-purple-500/10 font-bold rounded transition inline-block">
              Read More →
            </Link>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-20 px-4 bg-slate-900 relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent"></div>
        
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
              Why Choose CricIQ?
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              We are built specifically for cricket coaches who want results without complexity.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: '⚡',
                title: 'Lightning Fast',
                desc: 'Analyze videos in minutes, not hours. Get instant insights.'
              },
              {
                icon: '💰',
                title: 'Affordable',
                desc: 'Pay only for what you use. No hidden fees.'
              },
              {
                icon: '🎯',
                title: 'Accurate',
                desc: '98% action detection accuracy. Trust our analysis.'
              },
              {
                icon: '🤝',
                title: '24/7 Support',
                desc: 'Our team is always here to help you succeed.'
              }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
                className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:border-purple-500 hover:bg-slate-800/70 transition-all duration-300 text-center group"
              >
                <motion.div
                  whileHover={{ scale: 1.2, rotate: 10 }}
                  className="text-5xl mb-4 inline-block"
                >
                  {item.icon}
                </motion.div>
                <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                <p className="text-gray-300 text-sm">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-slate-800/30 relative">
        {/* Section Divider */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent"></div>
        
        <div className="max-w-6xl mx-auto">
          <motion.h2 
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-black text-white text-center mb-12"
          >
            {t.howItWorks}
          </motion.h2>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { icon: uploadVideoIcon, title: 'Upload Video', desc: 'Upload your cricket session video' },
              { icon: coachReviewIcon, title: 'Coach Reviews', desc: 'Get instant highlights & key moments' },
              { icon: reviewTimelineIcon, title: 'Review Timeline', desc: 'Browse clips with timestamps' },
              { icon: getInsightsIcon, title: 'Get Insights', desc: 'Receive feedback & performance summary' }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
                className="text-center group"
              >
                <motion.div 
                  whileHover={{ scale: 1.1, y: -5 }}
                  className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:shadow-lg group-hover:shadow-purple-500/50 transition-all duration-300"
                >
                  <img src={item.icon} alt={item.title} className="w-12 h-12 object-contain" />
                </motion.div>
                <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                <p className="text-gray-300 text-sm">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>


      {showDemoModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-lg max-w-2xl w-full">
            <div className="flex justify-between items-center p-6 border-b border-slate-700">
              <h3 className="text-xl font-bold text-white">CricIQ Demo</h3>
              <button 
                onClick={() => setShowDemoModal(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
                <iframe
                  width="100%"
                  height="100%"
                  src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1"
                  title="CricIQ Demo"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0"
                ></iframe>
              </div>
            </div>
          </div>
        </div>
      )}

            {/* Testimonials Section */}
      <section id="testimonials" className="py-20 px-4 bg-slate-800/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-black text-white text-center mb-4">
            Trusted by Real Coaches
          </h2>
          <p className="text-lg text-gray-300 text-center mb-16">
            See how professional coaches across different sports use CricIQ to improve their teams
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                quote: "It's an agile, dynamic, and adaptable tool that allows me to cut my videos from any device.",
                author: 'Antonio Crespo',
                sport: 'Futsal',
                team: 'Dehesa Villalba',
                experience: '20 years coaching'
              },
              {
                quote: 'Create video clips without wasting too much time.',
                author: 'Roberto Sánchez',
                sport: 'Basketball',
                team: 'Basket Cervantes',
                experience: '22 years coaching'
              }
            ].map((testimonial, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-slate-700/50 border border-slate-600 rounded-lg p-8 hover:border-purple-500 transition"
              >
                <p className="text-gray-300 mb-6 italic text-lg">\"{ testimonial.quote }\"</p>
                <div className="border-t border-slate-600 pt-4">
                  <p className="text-white font-bold text-lg">{testimonial.author}</p>
                  <p className="text-purple-400 font-semibold">{testimonial.sport}</p>
                  <p className="text-gray-400 text-sm">{testimonial.team}</p>
                  <p className="text-gray-500 text-sm">• {testimonial.experience}</p>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link to="/testimonials" className="px-6 py-2 border-2 border-purple-500 text-purple-400 hover:bg-purple-500/10 font-bold rounded transition inline-block">
              Read More →
            </Link>
          </div>
        </div>
      </section>

            {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-slate-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
            Honest pricing for real coaches
          </h2>
          <p className="text-xl text-gray-300 mb-12">
            Pay only for what you use. No subscriptions, no commitments. Exactly as it should be for amateur coaches
          </p>
          
          <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-12">
            <p className="text-gray-300 text-lg mb-8">
              Simple, transparent pricing designed for coaches with real budgets
            </p>
            <Link to="/register" className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold text-lg rounded transition inline-block">
              View Pricing Plans
            </Link>
          </div>
          <div className="text-center mt-8">
            <Link to="/pricing" className="px-6 py-2 border-2 border-purple-500 text-purple-400 hover:bg-purple-500/10 font-bold rounded transition inline-block">
              View All Plans →
            </Link>
          </div>
        </div>
      </section>

      {/* Success Stories Section */}
      <section className="py-20 px-4 bg-slate-900 relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent"></div>
        
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              {t.successStories}
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              {t.coachesImproving}
            </p>
            <p className="text-lg text-gray-400 mt-2">
              {t.successDesc}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {[
              {
                name: 'Rajesh Kumar',
                role: 'Cricket Coach',
                team: 'Delhi Youth Academy',
                improvement: '34%',
                metric: 'Player Performance',
                quote: 'CricIQ cut my analysis time by 80%. Now I focus on coaching, not editing.',
                image: '🏐'
              },
              {
                name: 'Priya Sharma',
                role: 'Batting Coach',
                team: 'Mumbai Cricket Club',
                improvement: '28%',
                metric: 'Batting Accuracy',
                quote: 'The technique analysis is incredibly accurate. My players improved faster than ever.',
                image: '⚾'
              },
              {
                name: 'Amit Patel',
                role: 'Head Coach',
                team: 'Bangalore Sports Academy',
                improvement: '42%',
                metric: 'Team Consistency',
                quote: 'Best investment for our academy. The ROI is immediate and measurable.',
                image: '🎯'
              }
            ].map((story, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
                className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border border-slate-600 rounded-lg p-8 hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-300 group"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                    {story.image}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{story.name}</h3>
                    <p className="text-purple-400 font-semibold text-sm">{story.role}</p>
                    <p className="text-gray-400 text-xs">{story.team}</p>
                  </div>
                </div>
                
                <div className="mb-6 p-4 bg-slate-900/50 rounded-lg border border-slate-600">
                  <p className="text-gray-300 italic text-sm">\"{ story.quote }\"</p>
                </div>

                <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-4 border border-purple-500/30">
                  <div className="text-center">
                    <div className="text-3xl font-black bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                      {story.improvement}
                    </div>
                    <p className="text-gray-300 text-sm font-semibold mt-1">{story.metric}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Success Metrics */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {[
              { icon: '📊', value: '1,247', label: t.coachesTransformed },
              { icon: '⏱️', value: '15.2K', label: t.timesSaved },
              { icon: '🎯', value: '31%', label: t.avgImprovement }
            ].map((metric, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
                className="bg-slate-800/50 border border-slate-600 rounded-lg p-6 text-center hover:border-purple-500 transition-all duration-300"
              >
                <div className="text-4xl mb-3">{metric.icon}</div>
                <div className="text-3xl font-black bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-2">
                  {metric.value}
                </div>
                <p className="text-gray-300 font-semibold">{metric.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-slate-800/30 relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent"></div>
        
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <div className="inline-block mb-6 px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-full">
              <p className="text-red-400 font-bold text-sm">⚡ {t.limitedOffer}</p>
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
              {t.readyToStart}
            </h2>
            <p className="text-lg text-gray-300 mb-8">
              {t.createAccount}
            </p>
          </motion.div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative"
            >
              <Link to="/register" className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold rounded transition shadow-lg hover:shadow-xl block">
                {t.joinNow}
              </Link>
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -top-3 -right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full"
              >
                🔥 Only 23 left
              </motion.div>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link to="/login" className="px-8 py-3 border-2 border-purple-500 text-purple-400 hover:bg-purple-500/10 font-bold rounded transition block text-center">
                {t.signIn}
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

            {/* Newsletter Section */}
      <section className="py-20 px-4 bg-slate-800/50 relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent"></div>
        
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
              Stay in the Loop
            </h2>
            <p className="text-lg text-gray-300 mb-8">
              Get exclusive tips, product updates, and special offers delivered to your inbox
            </p>
          </motion.div>

          <motion.form
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            onSubmit={handleNewsletterSubmit}
            className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              className="flex-1 px-4 py-3 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:border-purple-500 transition"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="submit"
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold rounded transition"
            >
              Subscribe
            </motion.button>
          </motion.form>

          <p className="text-gray-400 text-sm mt-4">
            No spam, unsubscribe anytime. We respect your privacy.
          </p>
        </div>
      </section>

      {/* Comparison Table Section */}
      <section className="py-20 px-4 bg-slate-900 relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent"></div>
        
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              Why CricIQ Wins
            </h2>
            <p className="text-lg text-gray-300">
              See how we compare to other video analysis tools
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="overflow-x-auto"
          >
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="px-6 py-4 text-white font-bold">Feature</th>
                  <th className="px-6 py-4 text-center">
                    <div className="text-white font-bold">CricIQ</div>
                    <div className="text-purple-400 text-sm">Our Platform</div>
                  </th>
                  <th className="px-6 py-4 text-center">
                    <div className="text-gray-300 font-bold">Competitor A</div>
                    <div className="text-gray-500 text-sm">Traditional Tool</div>
                  </th>
                  <th className="px-6 py-4 text-center">
                    <div className="text-gray-300 font-bold">Competitor B</div>
                    <div className="text-gray-500 text-sm">Basic Tool</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'Action Detection', cv: true, c1: true, c2: false },
                  { feature: 'Technique Analysis', cv: true, c1: true, c2: false },
                  { feature: 'AI Recommendations', cv: true, c1: false, c2: false },
                  { feature: 'Performance Metrics', cv: true, c1: true, c2: true },
                  { feature: 'Auto Highlights', cv: true, c1: false, c2: false },
                  { feature: 'Mobile Support', cv: true, c1: true, c2: true },
                  { feature: 'Free Trial', cv: true, c1: false, c2: true },
                  { feature: 'Pricing', cv: 'Pay-as-you-go', c1: '$500/mo', c2: '$200/mo' },
                  { feature: '24/7 Support', cv: true, c1: false, c2: false }
                ].map((row, i) => (
                  <tr key={i} className="border-b border-slate-700 hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4 text-white font-semibold">{row.feature}</td>
                    <td className="px-6 py-4 text-center">
                      {typeof row.cv === 'boolean' ? (
                        row.cv ? (
                          <span className="text-green-400 text-xl">✓</span>
                        ) : (
                          <span className="text-gray-500 text-xl">✗</span>
                        )
                      ) : (
                        <span className="text-purple-400 font-bold">{row.cv}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {typeof row.c1 === 'boolean' ? (
                        row.c1 ? (
                          <span className="text-green-400 text-xl">✓</span>
                        ) : (
                          <span className="text-gray-500 text-xl">✗</span>
                        )
                      ) : (
                        <span className="text-gray-300 font-bold">{row.c1}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {typeof row.c2 === 'boolean' ? (
                        row.c2 ? (
                          <span className="text-green-400 text-xl">✓</span>
                        ) : (
                          <span className="text-gray-500 text-xl">✗</span>
                        )
                      ) : (
                        <span className="text-gray-300 font-bold">{row.c2}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>

          <div className="text-center mt-12">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link to="/register" className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold rounded transition inline-block">
                Start Your Free Trial
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trust Indicators Section */}
      <section className="py-16 px-4 bg-slate-800/50 relative">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { icon: '🔒', label: 'SSL Encrypted', desc: 'Your data is secure' },
              { icon: '✓', label: 'GDPR Compliant', desc: 'Privacy protected' },
              { icon: '⭐', label: '4.9/5 Rating', desc: '500+ reviews' },
              { icon: '🏆', label: 'Award Winning', desc: 'Industry recognized' }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
              >
                <div className="text-4xl mb-2">{item.icon}</div>
                <p className="text-white font-bold text-sm">{item.label}</p>
                <p className="text-gray-400 text-xs">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4 bg-slate-800/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-black text-white text-center mb-12">
            Frequently Asked Questions
          </h2>

          <div className="space-y-4">
            {[
              {
                q: 'Is CricIQ really free to start?',
                a: 'Yes! You get 20 free credits when you sign up, plus 10 free credits every month. No credit card required.'
              },
              {
                q: 'Can I use CricIQ on mobile?',
                a: 'Absolutely! Our platform is fully responsive and works on any device - phone, tablet, or desktop.'
              },
              {
                q: 'How long does video analysis take?',
                a: 'Most videos are analyzed within minutes. The exact time depends on video length and complexity.'
              },
              {
                q: 'Do I need technical expertise to use it?',
                a: 'No! CricIQ is designed for coaches, not tech experts. Our interface is intuitive and easy to learn.'
              },
              {
                q: 'Can I export my analysis?',
                a: 'Yes! You can download reports, clips, and insights in multiple formats for sharing with your team.'
              },
              {
                q: 'What sports does CricIQ support?',
                a: 'We specialize in cricket analysis (batting, bowling, fielding) but our platform is expanding to other sports.'
              }
            ].map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-slate-700/50 border border-slate-600 rounded-lg p-6 hover:border-purple-500 transition"
              >
                <h3 className="text-lg font-bold text-white mb-3">{faq.q}</h3>
                <p className="text-gray-300">{faq.a}</p>
              </motion.div>
            ))}
          </div>
          <div className="text-center mt-8">
            <a href="#faq" className="px-6 py-2 border-2 border-purple-500 text-purple-400 hover:bg-purple-500/10 font-bold rounded transition inline-block">
              View All FAQs →
            </a>
          </div>
        </div>
      </section>
      <footer className="bg-slate-950 text-white py-8 px-4 border-t border-slate-700">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            {/* Logo & CTA */}
            <div>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-10 h-10 rounded-lg overflow-hidden">
                  <img src={appLogo} alt="CricIQ Logo" className="w-full h-full object-cover" />
                </div>
                <span className="text-xl font-bold text-white">CricIQ</span>
              </div>
              <Link to="/register" className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold rounded transition inline-block">
                REGISTER NOW FOR FREE
              </Link>
            </div>

            {/* Product Links */}
            <div>
              <h4 className="text-white font-bold mb-4">Product</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="text-gray-400 hover:text-white transition">Features</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition">Pricing</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition">How It Works</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition">Testimonials</a></li>
              </ul>
            </div>

            {/* Legal Links */}
            <div>
              <h4 className="text-white font-bold mb-4">Legal</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition">Terms</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition">Privacy</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition">Contact</a></li>
              </ul>
            </div>

            {/* Social Media */}
            <div>
              <h4 className="text-white font-bold mb-4">Follow Us</h4>
              <div className="flex gap-4">
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-400 transition text-2xl">
                  <span>f</span>
                </a>
                <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-400 transition text-2xl">
                  𝕏
                </a>
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-pink-400 transition text-2xl">
                  📷
                </a>
                <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-red-400 transition text-2xl">
                  ▶
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Footer */}
          <div className="border-t border-slate-700 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="text-gray-400 text-sm mb-4 md:mb-0">
                <a href="#" className="hover:text-white transition">Privacy Policy</a>
                <span className="mx-2">•</span>
                <a href="#" className="hover:text-white transition">Terms of Service</a>
              </div>
              <div className="text-gray-400 text-sm">
                Copyright © CricIQ 2024
              </div>
            </div>
          </div>
        </div>
      </footer>
      
      {/* Scroll to Top Button */}
      <motion.button
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: showScrollTop ? 1 : 0, scale: showScrollTop ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        onClick={scrollToTop}
        className="fixed bottom-24 right-8 z-40 w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full shadow-lg hover:shadow-xl flex items-center justify-center text-white text-xl transition-all duration-300 hover:scale-110"
        title="Scroll to top"
      >
        ↑
      </motion.button>

      {/* Floating Chat Widget */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="fixed bottom-8 right-8 z-40"
      >
        {showChat && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="absolute bottom-20 right-0 w-96 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl flex flex-col h-96 mb-4"
          >
            {/* Chat Header */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 rounded-t-lg flex justify-between items-center">
              <div>
                <h3 className="text-white font-bold">CricIQ Assistant</h3>
                <p className="text-blue-100 text-xs">Always here to help 🤖</p>
              </div>
              <button
                onClick={() => setShowChat(false)}
                className="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs px-4 py-2 rounded-lg ${
                      msg.sender === 'user'
                        ? 'bg-blue-500 text-white rounded-br-none'
                        : 'bg-slate-700 text-gray-100 rounded-bl-none'
                    }`}
                  >
                    <p className="text-sm">{msg.text}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Input */}
            <div className="border-t border-slate-600 p-4 flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything..."
                className="flex-1 bg-slate-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={handleSendMessage}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded px-4 py-2 transition font-semibold text-sm"
              >
                Send
              </button>
            </div>
          </motion.div>
        )}

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowChat(!showChat)}
          className="w-14 h-14 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full shadow-lg hover:shadow-xl flex items-center justify-center text-white text-2xl transition-all duration-300 group"
          title="Chat with us"
        >
          <motion.span
            animate={{ rotate: showChat ? 0 : [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            💬
          </motion.span>
          <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
        </motion.button>
      </motion.div>
    </div>
  );
}
