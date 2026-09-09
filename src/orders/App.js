// ============================================================================
// MERCA V7 — VERSION COMPLÈTE
// Nouveautés par rapport à la V5/V6 :
// 1. Accès INVITÉ (sans inscription) : parcourir le catalogue est possible
//    sans compte, mais sans les 3000 points de bienvenue, sans recherche
//    élargie (juste la recherche exacte) et sans accès à PERMUTA — un
//    message invite à s'inscrire pour débloquer le reste.
// 2. Réservation de service (Employé Pro) : un client parcourt les services
//    disponibles, choisit un créneau, réserve — l'Employé Pro confirme puis
//    marque "Terminé".
// 3. Avis (notes 1 à 5 étoiles + commentaire) sur une boutique ou un bureau,
//    affichés en moyenne sur leur page.
// 4. Support par commande/réservation : messagerie interne simple +
//    signalement d'un problème (réclamation/litige).
// 5. Vérification d'identité (KYC) simulée dans les Paramètres, avec badge
//    "✅ Vérifié" affiché sur la boutique/le bureau/le profil livreur.
// 6. Icônes de rôle redessinées : badges ronds colorés distincts par rôle
//    (Client=bleu, Commerçant=ambre, Livreur=vert, Employé Pro=violet).
// 7. Photo de profil (avatar) choisie par l'utilisateur, affichée partout
//    dans l'app à la place de l'icône générique.
//
// PRÉCISION IMPORTANTE ET HONNÊTE : une application ne peut pas remplacer
// TOUTE SEULE l'icône de l'app sur l'écran d'accueil du téléphone par une
// photo choisie librement par l'utilisateur — iOS et Android l'interdisent
// pour des raisons de sécurité (un logiciel malveillant pourrait sinon se
// faire passer pour une autre app). Ce qui EST possible, et que j'ai codé
// ci-dessous : une vraie photo de profil utilisée PARTOUT DANS L'APP
// (en-tête, profil, avis...). C'est l'équivalent qui fonctionne réellement.
//
// Dépendance à installer pour la photo de profil :
//   npm install expo-image-picker
// (ou l'équivalent react-native-image-picker si le projet n'utilise pas Expo)
// ============================================================================

import React, { useMemo, useState, useEffect } from "react";
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, ScrollView, FlatList, StyleSheet, Alert, Modal, Image, ImageBackground, Switch, Share } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
// (notifications push : chargées uniquement à l'usage, voir registerPushToken plus bas -
// évite un plantage au démarrage dans Expo Go, qui ne supporte plus cette fonctionnalité)

const STORAGE_KEY = "MERCA_STATE_V7";

const IMG = {
  hero_home:"https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=900",
  hero_client:"https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=900",
  hero_merchant:"https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=900",
  hero_courier:"https://images.unsplash.com/photo-1526367790999-0150786686a2?w=900",
  hero_wallet:"https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=900",
  hero_permuta:"https://images.unsplash.com/photo-1558655146-d09347e92766?w=900",
  hero_pro:"https://images.unsplash.com/photo-1497366216548-37526070297c?w=900",
  hero_auth:"https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=900",
  hero_services:"https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=900",
  iphone:"https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=500",
  samsung:"https://images.unsplash.com/photo-1610945264803-c22b62d2a7b3?w=500",
  pc:"https://images.unsplash.com/photo-1588872657576-7efd1f1555ed?w=500",
  baffle:"https://images.unsplash.com/photo-1545454675-3531b543be5d?w=500",
  canape:"https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500",
  boutique:"https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=400",
  bureau:"https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=400",
};

const R = { BLOQUE:50, FRAIS:0.033, BASE:1500, SPLIT_LIVREUR:600, SPLIT_MARCHAND:450, SPLIT_MERCA:450, BONUS_LIVRAISON:777, POINTS_INSCRIPTION:3000, ARGENT:5000, OR:11000, OR_CYCLE_MOIS:9 };

// ---- Connexion au vrai serveur (backend) MERCA hébergé sur Render ----
const API_BASE = "https://merca-backend-flwv.onrender.com";

async function apiRequestOtp(phone){
  const res = await fetch(`${API_BASE}/auth/otp/request`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ phone }) });
  if(!res.ok) throw new Error("Impossible d'envoyer le code. Vérifie ta connexion internet.");
  return res.json();
}
async function apiVerifyOtp(phone, code){
  const res = await fetch(`${API_BASE}/auth/otp/verify`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ phone, code }) });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message || "Code incorrect ou expiré");
  return data; // { accessToken, user }
}
async function apiGetWallet(token){
  const res = await fetch(`${API_BASE}/wallet`, { headers:{ Authorization:`Bearer ${token}` } });
  if(!res.ok) throw new Error("Impossible de charger le portefeuille");
  return res.json(); // { balance }
}
async function apiUpdateProfile(token, dto){
  const res = await fetch(`${API_BASE}/users/me`, { method:"PATCH", headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`}, body: JSON.stringify(dto) });
  if(!res.ok) throw new Error("Impossible de mettre à jour le profil");
  return res.json();
}
async function apiAddRole(token, dto){
  const res = await fetch(`${API_BASE}/users/me/roles`, { method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`}, body: JSON.stringify(dto) });
  if(!res.ok) throw new Error("Impossible d'activer ce rôle");
  return res.json();
}
// ---- Catalogue produits réel (serveur) ----
async function apiGetProducts(city){
  const res = await fetch(`${API_BASE}/products${city?`?city=${encodeURIComponent(city)}`:""}`);
  if(!res.ok) throw new Error("Impossible de charger les produits du serveur");
  return res.json();
}
async function apiCreateProduct(token, dto){
  const res = await fetch(`${API_BASE}/products`, { method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`}, body: JSON.stringify(dto) });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message || "Impossible de créer le produit");
  return data;
}
async function apiUpdateProduct(token, id, dto){
  const res = await fetch(`${API_BASE}/products/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`}, body: JSON.stringify(dto) });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message || "Impossible de modifier le produit");
  return data;
}
// Convertit un produit reçu du serveur (champs anglais/techniques) vers le
// format utilisé partout dans l'app (champs français déjà existants)
function serverToLocalProduct(p){
  return { id:p.id, merchantId:p.merchantId, name:p.name, price:Number(p.price), cat:p.category||"Autre", shop:p.shopName||"Boutique MERCA", rating:5, stock:p.stock, desc:p.description||"", ville:p.city||"Yaoundé", rayon:1, last: p.priceLockedUntil ? new Date(p.priceLockedUntil).getTime()-R.BLOQUE*86400000 : 0, img:p.img||IMG.boutique };
}
// ---- Commandes réelles (serveur) ----
async function apiCreateOrder(token, dto){
  const res = await fetch(`${API_BASE}/orders`, { method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`}, body: JSON.stringify(dto) });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message || "Impossible de créer la commande");
  return data;
}
async function apiAdvanceOrder(token, id){
  const res = await fetch(`${API_BASE}/orders/${id}/advance`, { method:"POST", headers:{ Authorization:`Bearer ${token}` } });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message || "Impossible de faire avancer la commande");
  return data;
}
async function apiConfirmOrder(token, id){
  const res = await fetch(`${API_BASE}/orders/${id}/confirm`, { method:"POST", headers:{ Authorization:`Bearer ${token}` } });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.message || "Impossible de confirmer la réception");
  return data;
}
async function apiGetMyOrders(token){
  const res = await fetch(`${API_BASE}/orders/mine`, { headers:{ Authorization:`Bearer ${token}` } });
  if(!res.ok) throw new Error("Impossible de charger tes commandes");
  return res.json();
}
async function apiGetOrdersToFulfill(token){
  const res = await fetch(`${API_BASE}/orders/to-fulfill`, { headers:{ Authorization:`Bearer ${token}` } });
  if(!res.ok) throw new Error("Impossible de charger les commandes reçues");
  return res.json();
}
async function apiGetAvailableOrders(token){
  const res = await fetch(`${API_BASE}/orders/available`, { headers:{ Authorization:`Bearer ${token}` } });
  if(!res.ok) throw new Error("Impossible de charger les livraisons disponibles");
  return res.json();
}
async function apiGetMyDeliveries(token){
  const res = await fetch(`${API_BASE}/orders/deliveries`, { headers:{ Authorization:`Bearer ${token}` } });
  if(!res.ok) throw new Error("Impossible de charger tes livraisons");
  return res.json();
}
// Réveille le serveur dès l'ouverture de l'app (plan gratuit Render = mise en veille
// après inactivité, jusqu'à 50-90s pour redémarrer). Appelée tout de suite au chargement,
// pendant que l'utilisateur remplit le formulaire, pour que le serveur soit déjà prêt.
function apiWakeUp(){ fetch(`${API_BASE}/products`).catch(()=>{}); }

// Inscrit le téléphone pour recevoir de vraies notifications (même app fermée).
// Ne fonctionne que sur une vraie app installée, jamais dans Expo Go pendant
// les tests - échoue silencieusement dans ce cas, sans gêner le reste de l'app.
async function registerPushToken(accessToken){
  try{
    // Chargement différé (dynamique) : si le module échoue (cas d'Expo Go qui
    // ne supporte plus cette fonctionnalité), l'erreur est proprement rattrapée
    // ici, au lieu de faire planter l'app dès son ouverture.
    const Notifications = await import("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true }),
    });
    const { status } = await Notifications.requestPermissionsAsync();
    if(status!=="granted") return;
    const { data:pushToken } = await Notifications.getExpoPushTokenAsync();
    if(pushToken) await apiUpdateProfile(accessToken, { pushToken });
  }catch(e){ /* normal dans Expo Go - fonctionnera dans la vraie app installée */ }
}

const CATS=["Tous","Téléphones","Informatique","Électronique","Meubles","Vêtements","Chaussures"];
const PRO_DOMAINES=["Juridique","Santé","Beauté","Réparation","Éducation","Consulting","Informatique","Autre"];
const STEPS=["Commande reçue","Préparation","Livreur recherché","En livraison","Livrée"];
const BOOKING_STEPS=["Demande envoyée","Confirmée","Terminée"];
const DISPUTE_REASONS=["Produit/service non conforme","Retard","Vendeur injoignable","Problème de paiement","Autre"];

// Icônes de rôle redessinées : icône + couleur de marque distincte par rôle
const ROLES_INFO = {
  client:{ label:"Client", icon:"👤", color:"#4F8EF7", desc:"Acheter, gagner des points" },
  commercant:{ label:"Commerçant", icon:"🏪", color:"#F5A623", desc:"Vendre des produits depuis une boutique en ligne", champ:"Nom de la boutique" },
  livreur:{ label:"Livreur", icon:"🚚", color:"#22C55E", desc:"Livrer des commandes et gagner des points", champ:"Véhicule utilisé" },
  pro:{ label:"Employé Pro", icon:"🧑‍💼", color:"#8B5CF6", desc:"Vendre un service, dans n'importe quel domaine, depuis un bureau", champ:"Nom du bureau" },
};

// ---- Identité visuelle MERCA : couleurs de marque + icônes de signalisation
// par rôle, à la place d'anciennes photos génériques (plus fiable, plus rapide,
// et plus reconnaissable qu'une photo de stock qui ne charge pas toujours) ----
const BRAND = "#FF6B35"; // orange MERCA - accueil, connexion
const BANNERS = {
  home:{ color:BRAND, icon:"🛍️" },
  auth:{ color:BRAND, icon:"🛍️" },
  client:{ color:ROLES_INFO.client.color, icon:"👤" },
  merchant:{ color:ROLES_INFO.commercant.color, icon:"🏪" },
  courier:{ color:ROLES_INFO.livreur.color, icon:"🚚" },
  pro:{ color:ROLES_INFO.pro.color, icon:"🧑‍💼" },
  wallet:{ color:"#0EA5A5", icon:"💰" },
  permuta:{ color:"#06B6D4", icon:"🔄" },
  services:{ color:"#6366F1", icon:"🛎️" },
  settings:{ color:"#374151", icon:"⚙️" },
};

const INITIAL_PRODUCTS = [
  {id:"p1",name:"iPhone X 64Go",price:95000,cat:"Téléphones",shop:"Merca Mobile",rating:4.7,stock:5,desc:"Bon état 88% - Yaoundé Bastos",ville:"Yaoundé",rayon:0.5,last:0,img:IMG.iphone},
  {id:"p2",name:"Samsung A54 128Go",price:85000,cat:"Téléphones",shop:"Merca Mobile",rating:4.8,stock:8,desc:"Neuf scellé",ville:"Yaoundé",rayon:1.2,last:0,img:IMG.samsung},
  {id:"p3",name:"MacBook Air M1",price:420000,cat:"Informatique",shop:"Merca Tech",rating:4.9,stock:2,desc:"8Go/256Go",ville:"Yaoundé",rayon:0.9,last:0,img:IMG.pc},
  {id:"p4",name:"JBL Flip 6",price:35000,cat:"Électronique",shop:"Merca Audio",rating:4.5,stock:12,desc:"Étanche IPX7",ville:"Yaoundé",rayon:0.4,last:0,img:IMG.baffle},
  {id:"p5",name:"Canapé velours 3P",price:150000,cat:"Meubles",shop:"Merca Maison",rating:4.9,stock:2,desc:"Velours premium",ville:"Yaoundé",rayon:1.5,last:0,img:IMG.canape},
];

function uid(prefix){ return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`; }
function genUniqueCode(existingList, field){
  const used = new Set(existingList.map(o=>o[field]));
  let code; do { code = Math.floor(1000+Math.random()*9000).toString(); } while(used.has(code));
  return code;
}
// Génère 4 créneaux simples (pas de vrai calendrier ici, juste des options claires)
function genSlots(){
  const now=new Date(); const opts=[];
  for(let d=1; d<=2; d++){
    for(const h of [9,14]){
      const dt=new Date(now); dt.setDate(dt.getDate()+d); dt.setHours(h,0,0,0);
      opts.push({ id:`${d}-${h}`, label:`${d===1?"Demain":"Après-demain"} ${h}h00`, at:dt.getTime() });
    }
  }
  return opts;
}

export default function App(){
  const [ready,setReady]=useState(false);
  const [user,setUser]=useState(null); // null = écran d'accueil (choix inscription / invité)

  const [page,setPage]=useState("home"); const [hist,setHist]=useState([]);
  const [products,setProducts]=useState(INITIAL_PRODUCTS);
  const [services,setServices]=useState([]);
  const [search,setSearch]=useState(""); const [debouncedSearch,setDebouncedSearch]=useState("");
  const [cat,setCat]=useState("Tous"); const [ville,setVille]=useState("Yaoundé"); const [rayon,setRayon]=useState(5);
  const [selected,setSelected]=useState(null); const [selectedService,setSelectedService]=useState(null); const [selectedSlot,setSelectedSlot]=useState(null);
  const [orders,setOrders]=useState([]); const [selectedOrder,setSelectedOrder]=useState(null);
  // Listes réelles côté commerçant (commandes reçues) et côté livreur
  // (livraisons disponibles à prendre + celles déjà assignées à moi)
  const [incomingOrders,setIncomingOrders]=useState([]);
  const [availableDeliveries,setAvailableDeliveries]=useState([]);
  const [myDeliveries,setMyDeliveries]=useState([]);
  const [bookings,setBookings]=useState([]); const [selectedBooking,setSelectedBooking]=useState(null);
  const [wallet,setWallet]=useState(25000); const [points,setPoints]=useState(0); const [orDate,setOrDate]=useState(null);
  const [walletHistory,setWalletHistory]=useState([]);
  const [walletPin,setWalletPin]=useState("1234");
  const [pinInput,setPinInput]=useState(""); const [fails,setFails]=useState(0); const [blocked,setBlocked]=useState(0);
  const [permuta]=useState([{id:"pm1",name:"iPhone X contre Samsung",owner:"Client A",status:"Disponible",img1:IMG.iphone,img2:IMG.samsung}]);
  const [showAlternatives,setShowAlternatives]=useState(false);
  const [favorites,setFavorites]=useState([]);
  const [dark,setDark]=useState(false);
  const [notifEnabled,setNotifEnabled]=useState(true);
  const [reviews,setReviews]=useState([]); const [messages,setMessages]=useState([]); const [disputes,setDisputes]=useState([]);

  const [showAdd,setShowAdd]=useState(false); const [npName,setNpName]=useState(""); const [npPrice,setNpPrice]=useState(""); const [npCat,setNpCat]=useState("Électronique"); const [npStock,setNpStock]=useState("1");
  const [showEdit,setShowEdit]=useState(null); const [editPrice,setEditPrice]=useState(""); const [editStock,setEditStock]=useState("");

  const [showAddService,setShowAddService]=useState(false); const [nsName,setNsName]=useState(""); const [nsPrice,setNsPrice]=useState(""); const [nsDomaine,setNsDomaine]=useState(PRO_DOMAINES[0]); const [nsDesc,setNsDesc]=useState("");
  const [showEditService,setShowEditService]=useState(null); const [esPrice,setEsPrice]=useState("");

  const [regName,setRegName]=useState(""); const [regPhone,setRegPhone]=useState(""); const [regCity,setRegCity]=useState("Yaoundé");
  const [regRole,setRegRole]=useState(null); const [regExtra,setRegExtra]=useState(""); const [regDomaine,setRegDomaine]=useState(PRO_DOMAINES[0]);
  // ---- Connexion réelle au serveur (OTP = code à usage unique envoyé par SMS) ----
  const [accessToken,setAccessToken]=useState(null);
  const [otpStep,setOtpStep]=useState("form"); // "form" = saisie infos, "code" = saisie du code reçu
  const [otpCode,setOtpCode]=useState("");
  const [authLoading,setAuthLoading]=useState(false);
  const [authError,setAuthError]=useState("");

  const [roleModal,setRoleModal]=useState(null); const [roleExtra,setRoleExtra]=useState(""); const [roleDomaine,setRoleDomaine]=useState(PRO_DOMAINES[0]);
  const [showAccountEdit,setShowAccountEdit]=useState(false); const [accName,setAccName]=useState(""); const [accPhone,setAccPhone]=useState(""); const [accCity,setAccCity]=useState("");
  const [showPinChange,setShowPinChange]=useState(false); const [newPin,setNewPin]=useState(""); const [newPinConfirm,setNewPinConfirm]=useState("");

  // Avis
  const [reviewModal,setReviewModal]=useState(null); // {targetName, refId}
  const [reviewRating,setReviewRating]=useState(5); const [reviewComment,setReviewComment]=useState("");

  // Support (messagerie + litige)
  const [supportThread,setSupportThread]=useState(null); // id de commande ou réservation
  const [messageInput,setMessageInput]=useState("");
  const [showDisputeForm,setShowDisputeForm]=useState(false); const [disputeReason,setDisputeReason]=useState(DISPUTE_REASONS[0]); const [disputeDesc,setDisputeDesc]=useState("");

  // Vérification d'identité (KYC)
  const [kycModal,setKycModal]=useState(null); const [kycDoc,setKycDoc]=useState("");

  // ---- Chargement / sauvegarde ----
  useEffect(()=>{ apiWakeUp(); },[]); // réveille le serveur dès l'ouverture de l'app
  // Charge les vrais produits du serveur et les ajoute à ceux de démonstration
  // (ceux de démo restent visibles pour ne rien casser, mais ne sont pas sur le serveur)
  useEffect(()=>{ (async()=>{
    try{
      const serverProducts = await apiGetProducts();
      setProducts(ps=>{
        const demoOnly = ps.filter(p=>!p.merchantId);
        return [...serverProducts.map(serverToLocalProduct), ...demoOnly];
      });
    }catch(e){ /* pas grave - le catalogue de démo reste affiché */ }
  })(); },[]);
  useEffect(()=>{ (async()=>{
    try{
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if(raw){
        const s = JSON.parse(raw);
        if(s.user!==undefined) setUser(s.user);
        if(s.accessToken) setAccessToken(s.accessToken);
        if(s.products) setProducts(s.products);
        if(s.services) setServices(s.services);
        if(s.orders) setOrders(s.orders);
        if(s.bookings) setBookings(s.bookings);
        if(typeof s.wallet==="number") setWallet(s.wallet);
        if(typeof s.points==="number") setPoints(s.points);
        if(s.orDate) setOrDate(s.orDate);
        if(s.walletHistory) setWalletHistory(s.walletHistory);
        if(s.walletPin) setWalletPin(s.walletPin);
        if(s.favorites) setFavorites(s.favorites);
        if(typeof s.dark==="boolean") setDark(s.dark);
        if(typeof s.notifEnabled==="boolean") setNotifEnabled(s.notifEnabled);
        if(s.reviews) setReviews(s.reviews);
        if(s.messages) setMessages(s.messages);
        if(s.disputes) setDisputes(s.disputes);
      }
    }catch(e){ /* SIMULATION - lecture échouée, valeurs par défaut conservées */ }
    setReady(true);
  })(); },[]);

  useEffect(()=>{
    if(!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ user, accessToken, products, services, orders, bookings, wallet, points, orDate, walletHistory, walletPin, favorites, dark, notifEnabled, reviews, messages, disputes })).catch(()=>{});
  },[ready, user, accessToken, products, services, orders, bookings, wallet, points, orDate, walletHistory, walletPin, favorites, dark, notifEnabled, reviews, messages, disputes]);

  useEffect(()=>{ const t=setTimeout(()=>setDebouncedSearch(search),300); return ()=>clearTimeout(t); },[search]);

  const nav=(n)=>{ if(n===page) return; setHist(h=>[...h,page]); setPage(n); };
  // Rafraîchit automatiquement la bonne liste de commandes selon l'écran ouvert
  useEffect(()=>{
    if(page==="merchant") refreshIncomingOrders();
    if(page==="courier"){ refreshAvailableDeliveries(); refreshMyDeliveries(); }
    if(page==="orders" || page==="client") refreshMyOrders();
  },[page, accessToken]);
  const back=()=>{ if(hist.length===0){ setPage("home"); return; } setPage(hist[hist.length-1]); setHist(h=>h.slice(0,-1)); };
  const home=()=>{ setHist([]); setPage("home"); };
  const money=(v)=>Number(v||0).toLocaleString("fr-FR")+" FCFA";
  // Nettoie une description avant affichage client/partage : supprime toute
  // trace d'un ancien texte "Prix bloqué Xj" (info interne réservée au commerçant/pro)
  const cleanDesc=(d)=> (d||"").replace(/prix bloqu[ée]\s*\d+\s*j[^.\n]*\.?/gi,"").trim();

  // Reconstitue le format utilisé par l'app à partir d'une commande du serveur
  // (le serveur ne connaît que les identifiants, pas les noms/images -
  // on retrouve le produit correspondant dans le catalogue déjà chargé)
  const serverToLocalOrder=(o)=>{
    const product = products.find(p=>p.id===o.productId) || { name:"Produit", img:IMG.boutique, price:Number(o.price) };
    return { id:o.id, codeLivraison:o.deliveryCode, product, delivery: Number(o.deliveryFee)>0?"Livraison MERCA":"Retrait boutique", com:Number(o.commission), base:Number(o.deliveryFee), total:Number(o.total), status:o.status, step:o.step, merchant:product.shop||"", merchantId:o.merchantId, courierId:o.courierId, splitCourier:Number(o.splitCourier), splitMerchant:Number(o.splitMerchant) };
  };
  const refreshMyOrders=async()=>{ if(!accessToken) return; try{ const list=await apiGetMyOrders(accessToken); setOrders(list.map(serverToLocalOrder)); }catch(e){} };
  const refreshIncomingOrders=async()=>{ if(!accessToken) return; try{ const list=await apiGetOrdersToFulfill(accessToken); setIncomingOrders(list.map(serverToLocalOrder)); }catch(e){} };
  const refreshAvailableDeliveries=async()=>{ if(!accessToken) return; try{ const list=await apiGetAvailableOrders(accessToken); setAvailableDeliveries(list.map(serverToLocalOrder)); }catch(e){} };
  const refreshMyDeliveries=async()=>{ if(!accessToken) return; try{ const list=await apiGetMyDeliveries(accessToken); setMyDeliveries(list.map(serverToLocalOrder)); }catch(e){} };
  const refreshWalletBalance=async()=>{ if(!accessToken) return; try{ const w=await apiGetWallet(accessToken); setWallet(Number(w.balance)); }catch(e){} };
  const getLevel=()=>{ if(user?.guest) return "Invité"; if(points>=R.OR){ if(orDate && (Date.now()-orDate)/(30*24*60*60*1000) > R.OR_CYCLE_MOIS) return "ARGENT (Or expiré - 9 mois)"; return "OR"; } if(points>=R.ARGENT) return "ARGENT"; return "BRONZE"; };
  const approx=(a,b)=>{ a=a.toLowerCase(); b=b.toLowerCase(); return b.includes(a)||(a.includes('iphon')&&b.includes('iphone')); };
  const hasRole=(r)=> !!(user && user.roles && user.roles.includes(r));
  const isVerified=(r)=> !!(user && user.verifiedRoles && user.verifiedRoles.includes(r));
  const confirm=(t,m,a)=>Alert.alert(t,m,[{text:"Annuler",style:"cancel"},{text:"Confirmer",style:"destructive",onPress:a}]);
  const requireAccount=(action)=> Alert.alert("Compte requis", `Crée un compte gratuit pour ${action} (SIMULATION TEST - inscription rapide).`, [{text:"Plus tard",style:"cancel"},{text:"S'inscrire",onPress:()=>setUser(null)}]);

  const filteredExact=useMemo(()=>products.filter(p=>debouncedSearch!==''&&approx(debouncedSearch,p.name+" "+p.shop)),[products,debouncedSearch]);
  const filtered=useMemo(()=>products.filter(p=>(debouncedSearch===''||approx(debouncedSearch,p.name+" "+p.shop))&&(cat==="Tous"||p.cat===cat)&&p.ville===ville&&p.rayon<=rayon),[products,debouncedSearch,cat,ville,rayon]);
  const dispoServices=useMemo(()=>services.filter(s=>s.dispo),[services]);

  const toggleFavorite=(id)=> setFavorites(f=> f.includes(id) ? f.filter(x=>x!==id) : [...f,id]);

  // ---- Partage marketing (Niveau 1 : ouvre le partage natif du téléphone -
  // Facebook, Instagram, WhatsApp, etc. - avec un message professionnel déjà prêt) ----
  const shareService=(s)=>{
    const texte=`🧑‍💼 SERVICE PROFESSIONNEL — MERCA\n\n${s.name}\n💰 À partir de ${money(s.price)}\n🏢 ${user?.bureau||"Bureau professionnel"}\n\n${cleanDesc(s.desc)}\n\n✅ Réservation simple et rapide\n📲 Confirmation immédiate\n🔒 Paiement sécurisé\n\n👉 Réservez votre créneau sur MERCA !\n\n#MERCA #Yaoundé #ServicesPro`;
    Share.share({ message: texte }).catch(()=>{});
  };

  const avgRating=(targetName)=>{
    const rs=reviews.filter(r=>r.targetName===targetName);
    if(rs.length===0) return null;
    const avg=rs.reduce((s,r)=>s+r.rating,0)/rs.length;
    return { avg: Math.round(avg*10)/10, count: rs.length };
  };

  // ---- Partage marketing gratuit (ouvre Facebook, Instagram, WhatsApp... déjà installés sur le téléphone) ----
  // ---- Partage marketing gratuit (ouvre Facebook, Instagram, WhatsApp... déjà installés sur le téléphone) ----
  const shareProduct=async(p)=>{
    try{
      const desc=cleanDesc(p.desc);
      await Share.share({
        message: `🛍️ NOUVEAU SUR MERCA\n\n${p.name}\n💰 ${money(p.price)}\n📍 Disponible à ${p.ville||"Yaoundé"}\n${desc?`\n${desc}\n`:""}\n✅ Prix vérifié et garanti\n📦 Commande directe et sécurisée\n🚚 Livraison rapide\n\n👉 Commandez dès maintenant sur MERCA !\n\n#MERCA #Yaoundé #ShoppingCameroun`,
      });
    }catch(e){ /* utilisateur a annulé le partage, rien à faire */ }
  };

  // ---- Inscription / connexion réelle (étape 1 : demander le code) ----
  const startOtp=async()=>{
    if(!regName.trim()) return Alert.alert("Erreur","Le nom est requis");
    if(!regPhone.trim() || regPhone.trim().length<8) return Alert.alert("Erreur","Numéro de téléphone invalide");
    if(regRole && !regExtra.trim()) return Alert.alert("Erreur", `Le champ "${ROLES_INFO[regRole].champ}" est requis`);
    setAuthError(""); setAuthLoading(true);
    try{
      const r = await apiRequestOtp(regPhone.trim());
      if(r && r.devCode) setOtpCode(r.devCode); // phase de test : code auto-rempli, pas de vrai SMS envoyé
      setOtpStep("code");
    }catch(e){ setAuthError(e.message); }
    setAuthLoading(false);
  };

  // ---- Inscription / connexion réelle (étape 2 : vérifier le code reçu) ----
  const confirmOtp=async()=>{
    if(!otpCode.trim() || otpCode.trim().length!==6) return Alert.alert("Erreur","Entre le code à 6 chiffres reçu par SMS");
    setAuthError(""); setAuthLoading(true);
    try{
      const { accessToken:token, user:serverUser } = await apiVerifyOtp(regPhone.trim(), otpCode.trim());
      setAccessToken(token);
      registerPushToken(token); // en arrière-plan, ne bloque rien

      // Complète le profil côté serveur (le serveur ne connaissait que le numéro jusqu'ici)
      let updated=serverUser;
      try{ updated = await apiUpdateProfile(token, { name:regName.trim(), city:regCity }); }catch(e){}

      // Active le rôle choisi (commerçant / livreur / employé pro) côté serveur
      if(regRole){
        const extra={};
        if(regRole==="commercant") extra.shopName=regExtra.trim();
        if(regRole==="livreur") extra.vehicule=regExtra.trim();
        if(regRole==="pro"){ extra.bureau=regExtra.trim(); extra.domaine=regDomaine; }
        try{ updated = await apiAddRole(token, { role:regRole, ...extra }); }catch(e){}
      }

      // Solde réel du portefeuille (créé automatiquement par le serveur à l'inscription)
      let balance=25000;
      try{ const w=await apiGetWallet(token); balance=Number(w.balance); }catch(e){}

      setUser({ id:updated.id, name:updated.name||regName.trim(), phone:updated.phone, city:updated.city||regCity, roles:updated.roles||["client"], verifiedRoles:updated.verifiedRoles||[], avatarUri:null, guest:false, createdAt:Date.now(), shopName:updated.shopName, vehicule:updated.vehicule, bureau:updated.bureau, domaine:updated.domaine });
      setPoints(R.POINTS_INSCRIPTION); setWallet(balance);
      setWalletHistory([{id:"h0",type:"Bonus de bienvenue (portefeuille réel du serveur)",amount:balance,icon:"🧪",color:"#888"}]);
      setRegName(""); setRegPhone(""); setRegExtra(""); setRegRole(null); setOtpCode(""); setOtpStep("form");
    }catch(e){ setAuthError(e.message); }
    setAuthLoading(false);
  };

  const backToAuthForm=()=>{ setOtpStep("form"); setOtpCode(""); setAuthError(""); };

  // ---- Continuer sans compte (accès limité) ----
  const continueAsGuest=()=>{
    setUser({ id:"guest", name:"Invité", phone:"", city:regCity||"Yaoundé", roles:["client"], verifiedRoles:[], avatarUri:null, guest:true, createdAt:Date.now() });
    setPoints(0); setWallet(0); setWalletHistory([]);
  };

  const confirmAddRole=()=>{
    if(!roleModal) return;
    if(!roleExtra.trim()) return Alert.alert("Erreur", `Le champ "${ROLES_INFO[roleModal].champ}" est requis`);
    const extra={};
    if(roleModal==="commercant") extra.shopName=roleExtra.trim();
    if(roleModal==="livreur") extra.vehicule=roleExtra.trim();
    if(roleModal==="pro"){ extra.bureau=roleExtra.trim(); extra.domaine=roleDomaine; }
    setUser(u=>({ ...u, roles:[...new Set([...u.roles, roleModal])], ...extra }));
    setRoleModal(null); setRoleExtra("");
    Alert.alert("Rôle activé", `Espace ${ROLES_INFO[roleModal].label} disponible - SIMULATION`);
  };

  const openAccountEdit=()=>{ setAccName(user.name); setAccPhone(user.phone); setAccCity(user.city); setShowAccountEdit(true); };
  const saveAccountEdit=()=>{
    if(!accName.trim()) return Alert.alert("Erreur","Le nom est requis");
    if(!accPhone.trim() || accPhone.trim().length<8) return Alert.alert("Erreur","Numéro invalide");
    setUser(u=>({...u, name:accName.trim(), phone:accPhone.trim(), city:accCity}));
    setShowAccountEdit(false);
  };

  const savePinChange=()=>{
    if(!/^\d{4}$/.test(newPin)) return Alert.alert("Erreur","Le PIN doit contenir exactement 4 chiffres");
    if(newPin!==newPinConfirm) return Alert.alert("Erreur","Les deux codes PIN ne correspondent pas");
    setWalletPin(newPin); setNewPin(""); setNewPinConfirm(""); setShowPinChange(false);
    Alert.alert("PIN mis à jour","SIMULATION TEST");
  };

  const logout=()=> confirm("Déconnexion","Tu devras te reconnecter pour revenir. Tes données restent enregistrées sur cet appareil.",()=>{ setUser(null); home(); });
  const resetAllData=()=> confirm("Réinitialiser toutes les données","Cette action efface tout - SIMULATION TEST. Irréversible.",async()=>{
    await AsyncStorage.removeItem(STORAGE_KEY);
    setUser(null); setProducts(INITIAL_PRODUCTS); setServices([]); setOrders([]); setBookings([]); setWallet(0); setPoints(0); setOrDate(null);
    setWalletHistory([]); setWalletPin("1234"); setFavorites([]); setDark(false); setNotifEnabled(true); setReviews([]); setMessages([]); setDisputes([]); home();
  });

  // ---- Photo de profil (avatar) ----
  const pickAvatar=async()=>{
    // Sur l'aperçu WEB d'Expo Snack, l'accès aux photos du téléphone n'est
    // pas toujours disponible (c'est une limite de l'aperçu web, pas de ce
    // code) — teste cette fonction via le QR code / l'app Expo Go sur un
    // vrai téléphone pour qu'elle fonctionne. Le try/catch évite un plantage
    // de toute l'app si le module n'est pas disponible dans l'environnement.
    try{
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!perm.granted) return Alert.alert("Permission refusée","Autorise l'accès à tes photos pour choisir un avatar.");
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing:true, aspect:[1,1], quality:0.7 });
      if(!result.canceled && result.assets && result.assets[0]) {
        setUser(u=>({...u, avatarUri: result.assets[0].uri}));
      }
    }catch(e){
      Alert.alert("Photo indisponible ici","Sur l'aperçu web de Snack, essaie plutôt via le QR code sur ton téléphone.");
    }
  };

  // ---- Commandes produit (identique V5, avec vérification invité) ----
  const createOrder=async(product,delivery)=>{
    if(user.guest) return requireAccount("passer une commande");
    if(!accessToken) return Alert.alert("Erreur","Reconnecte-toi (session expirée).");
    if(Date.now()<blocked) return Alert.alert("SIMULATION TEST","Compte bloqué temporairement");
    if(!product.merchantId) return Alert.alert("Produit de démonstration","Ce produit n'existe pas vraiment sur le serveur - choisis un produit ajouté par un vrai commerçant pour passer une vraie commande.");
    const isDelivery = delivery==="Livraison MERCA";
    const com=Math.round(product.price*R.FRAIS);
    const tot=product.price + (isDelivery? R.BASE + com : 0);
    if(wallet<tot) return Alert.alert("Solde insuffisant","");
    if(product.stock<=0) return Alert.alert("Rupture de stock","");
    try{
      const created = await apiCreateOrder(accessToken, { productId:product.id, merchantId:product.merchantId, productPrice:product.price, delivery:isDelivery, idempotencyKey:uid("idem") });
      const o = serverToLocalOrder(created);
      setOrders(os=>[o,...os]);
      setProducts(ps=>ps.map(p=>p.id===product.id?{...p,stock:Math.max(0,p.stock-1)}:p));
      setSelectedOrder(o);
      await refreshWalletBalance();
      setWalletHistory(h=>[{id:uid("h"),type:`${product.name} - Code ${o.codeLivraison}`,amount:-o.total,icon:"📦",color:"#111"},...h]);
      nav("tracking");
    }catch(e){ Alert.alert("Erreur", e.message); }
  };

  // Fait avancer une commande d'une étape (appelé depuis l'écran du
  // commerçant ou du livreur, selon l'étape - le serveur vérifie les droits)
  const doAdvance=async(order, onDone)=>{
    if(!accessToken) return;
    try{
      await apiAdvanceOrder(accessToken, order.id);
      if(onDone) await onDone();
    }catch(e){ Alert.alert("Erreur", e.message); }
  };

  const confirmReception=(order)=>{
    confirm(`Confirmer réception - Code ${order.codeLivraison}`,`Débloque les fonds vers le commerçant/livreur - +${R.BONUS_LIVRAISON} pts`,async()=>{
      if(!accessToken) return;
      try{
        const updated = await apiConfirmOrder(accessToken, order.id);
        const u = serverToLocalOrder(updated);
        setOrders(os=>os.map(o=>o.id===order.id?u:o)); setSelectedOrder(u);
        setPoints(p=>{ const np=p+R.BONUS_LIVRAISON; if(np>=R.OR && !orDate) setOrDate(Date.now()); return np; });
        Alert.alert("Confirmé !",`+${R.BONUS_LIVRAISON} pts - Code ${order.codeLivraison}`);
        nav("home");
      }catch(e){ Alert.alert("Erreur", e.message); }
    });
  };

  const createProd=async()=>{
    const priceNum=parseFloat(npPrice); const stockNum=parseInt(npStock,10);
    if(!npName.trim()) return Alert.alert("Erreur","Nom du produit requis");
    if(isNaN(priceNum) || priceNum<=0) return Alert.alert("Erreur","Prix invalide");
    if(isNaN(stockNum) || stockNum<0) return Alert.alert("Erreur","Stock invalide");
    if(!accessToken){ return Alert.alert("Erreur","Reconnecte-toi pour ajouter un produit (session expirée)."); }
    try{
      const created = await apiCreateProduct(accessToken, { name:npName.trim(), price:priceNum, stock:stockNum, category:npCat, city:user.city||"Yaoundé", shopName:user.shopName });
      setProducts(ps=>[serverToLocalProduct(created), ...ps]);
      setShowAdd(false); setNpName(""); setNpPrice(""); setNpStock("1");
    }catch(e){ Alert.alert("Erreur", e.message); }
  };
  const openEdit=(p)=>{ setShowEdit(p); setEditPrice(String(p.price)); setEditStock(String(p.stock)); };
  const updateProd=async()=>{
    if(!showEdit) return;
    const locked = Date.now()-showEdit.last < R.BLOQUE*86400000;
    if(locked){ const j=Math.ceil((R.BLOQUE*86400000-(Date.now()-showEdit.last))/86400000); return Alert.alert(`Bloqué encore ${j}j`,`Le prix ne peut pas changer avant ${j} jour(s).`); }
    const priceNum=parseFloat(editPrice); const stockNum=parseInt(editStock,10);
    if(isNaN(priceNum) || priceNum<=0) return Alert.alert("Erreur","Prix invalide");
    if(isNaN(stockNum) || stockNum<0) return Alert.alert("Erreur","Stock invalide");
    confirm(`Modifier - bloqué ${R.BLOQUE}j après ce changement`, `Nouveau prix ${money(priceNum)} ?`, async()=>{
      if(showEdit.merchantId && accessToken){
        try{
          const updated = await apiUpdateProduct(accessToken, showEdit.id, { price:priceNum, stock:stockNum });
          setProducts(ps=>ps.map(pr=>pr.id===showEdit.id?serverToLocalProduct(updated):pr));
        }catch(e){ Alert.alert("Erreur", e.message); return; }
      }else{
        setProducts(ps=>ps.map(pr=>pr.id===showEdit.id?{...pr,price:priceNum,stock:stockNum,last:Date.now()}:pr));
      }
      setShowEdit(null);
    });
  };

  const createService=()=>{
    const priceNum=parseFloat(nsPrice);
    if(!nsName.trim()) return Alert.alert("Erreur","Nom du service requis");
    if(isNaN(priceNum) || priceNum<=0) return Alert.alert("Erreur","Tarif invalide");
    const s={ id:uid("s"), name:nsName.trim(), price:priceNum, domaine:nsDomaine, desc:nsDesc.trim(), bureau:user.bureau, proId:user.id, dispo:true, last:Date.now() };
    setServices(ss=>[s,...ss]); setShowAddService(false); setNsName(""); setNsPrice(""); setNsDesc("");
  };
  const openEditService=(s)=>{ setShowEditService(s); setEsPrice(String(s.price)); };
  const updateService=()=>{
    if(!showEditService) return;
    const locked = Date.now()-showEditService.last < R.BLOQUE*86400000;
    if(locked){ const j=Math.ceil((R.BLOQUE*86400000-(Date.now()-showEditService.last))/86400000); return Alert.alert(`Bloqué encore ${j}j`,`Le tarif ne peut pas changer avant ${j} jour(s).`); }
    const priceNum=parseFloat(esPrice);
    if(isNaN(priceNum) || priceNum<=0) return Alert.alert("Erreur","Tarif invalide");
    confirm(`Modifier - bloqué ${R.BLOQUE}j`, `Nouveau tarif ${money(priceNum)} ?`, ()=>{
      setServices(ss=>ss.map(s=>s.id===showEditService.id?{...s,price:priceNum,last:Date.now()}:s));
      setShowEditService(null);
    });
  };
  const toggleDispo=(id)=> setServices(ss=>ss.map(s=>s.id===id?{...s,dispo:!s.dispo}:s));

  // ---- Réservation de service ----
  const createBooking=()=>{
    if(user.guest) return requireAccount("réserver un service");
    if(!selectedService || !selectedSlot) return;
    const com=Math.round(selectedService.price*R.FRAIS); const tot=selectedService.price+com;
    if(wallet<tot) return Alert.alert("Solde insuffisant","SIMULATION TEST");
    const code=genUniqueCode(bookings,"bookingCode");
    const b={ id:uid("BK"), txId:uid("TX"), bookingCode:code, service:selectedService, slot:selectedSlot, price:selectedService.price, com, total:tot, status:BOOKING_STEPS[0], step:0, createdAt:Date.now() };
    setBookings(bs=>[b,...bs]); setWallet(w=>w-tot);
    setWalletHistory(h=>[{id:uid("h"),type:`SIMULATION TEST - Réservation ${selectedService.name} - Code ${code}`,amount:-tot,icon:"📅",color:"#111"},...h]);
    setSelectedBooking(b); setSelectedSlot(null); nav("bookingTracking");
  };
  const proConfirmBooking=(b)=>{ const u={...b,status:BOOKING_STEPS[1],step:1}; setBookings(bs=>bs.map(x=>x.id===b.id?u:x)); };
  const proCompleteBooking=(b)=>{
    confirm("Marquer terminé", `Débloque ${money(b.total)} pour ton bureau - Code ${b.bookingCode}`, ()=>{
      const u={...b,status:BOOKING_STEPS[2],step:2}; setBookings(bs=>bs.map(x=>x.id===b.id?u:x));
    });
  };
  const cancelBooking=(b)=>{
    confirm("Annuler la réservation", "Le montant sera remboursé - SIMULATION", ()=>{
      setBookings(bs=>bs.filter(x=>x.id!==b.id));
      setWallet(w=>w+b.total);
      setWalletHistory(h=>[{id:uid("h"),type:`SIMULATION TEST - Remboursement réservation annulée - Code ${b.bookingCode}`,amount:b.total,icon:"↩️",color:"#00a651"},...h]);
      nav("home");
    });
  };

  // ---- Avis ----
  const openReview=(targetName, refId)=>{ setReviewModal({targetName, refId}); setReviewRating(5); setReviewComment(""); };
  const submitReview=()=>{
    if(!reviewModal) return;
    setReviews(rs=>[{ id:uid("rv"), targetName:reviewModal.targetName, refId:reviewModal.refId, rating:reviewRating, comment:reviewComment.trim(), author:user.name, createdAt:Date.now() }, ...rs]);
    setReviewModal(null);
    Alert.alert("Merci !","Ton avis a été enregistré - SIMULATION TEST");
  };

  // ---- Support (messages + litige) ----
  const threadMessages=(threadId)=> messages.filter(m=>m.threadId===threadId);
  const sendMessage=()=>{
    if(!messageInput.trim() || !supportThread) return;
    setMessages(ms=>[...ms,{ id:uid("msg"), threadId:supportThread, from:"client", text:messageInput.trim(), at:Date.now() }]);
    setMessageInput("");
  };
  const submitDispute=()=>{
    if(!disputeDesc.trim()) return Alert.alert("Erreur","Décris le problème");
    setDisputes(ds=>[{ id:uid("d"), threadId:supportThread, reason:disputeReason, description:disputeDesc.trim(), status:"Ouvert", createdAt:Date.now() },...ds]);
    setShowDisputeForm(false); setDisputeDesc("");
    Alert.alert("Réclamation envoyée","SIMULATION TEST - en cours de traitement");
  };

  // ---- KYC ----
  const submitKyc=()=>{
    if(!kycModal) return;
    if(!kycDoc.trim()) return Alert.alert("Erreur","Numéro de pièce d'identité requis");
    setUser(u=>({...u, verifiedRoles:[...new Set([...(u.verifiedRoles||[]), kycModal])]}));
    setKycModal(null); setKycDoc("");
    Alert.alert("Vérifié","SIMULATION TEST - dans une vraie version, un humain ou un service tiers doit contrôler le document avant validation.");
  };

  // (la prise de livraison se fait maintenant via doAdvance, voir écran "courier" plus bas)

  const T = dark
    ? { bg:"#121417", card:"#1D2024", text:"#F3F4F6", sub:"rgba(243,244,246,0.6)", header:"#1D2024" }
    : { bg:"#F6F7F9", card:"#FFFFFF", text:"#111111", sub:"rgba(17,17,17,0.6)", header:"#FFFFFF" };

  if(!ready){
    return <SafeAreaView style={[styles.container,{backgroundColor:T.bg}]}><View style={styles.empty5D}><Text>Chargement MERCA...</Text></View></SafeAreaView>;
  }

  // ================= ÉCRAN D'ACCUEIL (inscription OU invité) =================
  if(!user){
    return (
      <SafeAreaView style={[styles.container,{backgroundColor:T.bg}]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Banner color={BANNERS.auth.color} icon={BANNERS.auth.icon} style={styles.hero5D} radius={24}>
            <View style={styles.hero5DOverlay}><Text style={styles.hero5DTitle}>Bienvenue sur MERCA</Text><Text style={styles.hero5DSub}>SIMULATION TEST - pas de vrai SMS envoyé</Text></View>
          </Banner>

          {otpStep==="form" && (
          <TouchableOpacity style={styles.guestBtn5D} onPress={continueAsGuest}>
            <Text style={styles.guestBtn5DT}>👀 Continuer sans compte (accès limité)</Text>
          </TouchableOpacity>
          )}
          {otpStep==="form" && <Text style={styles.ruleD5D}>Sans compte : tu peux voir le catalogue avec la recherche exacte, mais pas les points de bienvenue, pas d'achat, pas d'accès à PERMUTA ni aux réservations. Inscris-toi pour tout débloquer.</Text>}

          {otpStep==="form" ? (
          <>
          <View style={[styles.card5DLarge,{backgroundColor:T.card, marginTop:16}]}>
            <Text style={[styles.cardTitle5D,{color:T.text}]}>Créer un compte complet</Text>
            <TextInput value={regName} onChangeText={setRegName} placeholder="Nom complet" style={styles.input5D}/>
            <TextInput value={regPhone} onChangeText={setRegPhone} placeholder="Numéro de téléphone" keyboardType="phone-pad" style={styles.input5D}/>
            <TextInput value={regCity} onChangeText={setRegCity} placeholder="Ville" style={styles.input5D}/>
          </View>

          <Text style={[styles.section5D,{color:T.text}]}>Comment veux-tu utiliser MERCA ?</Text>
          <RoleCard active={regRole===null} icon={ROLES_INFO.client.icon} color={ROLES_INFO.client.color} label="Client uniquement" desc="Acheter, gagner des points" onPress={()=>setRegRole(null)}/>
          {["commercant","livreur","pro"].map(key=>(
            <RoleCard key={key} active={regRole===key} icon={ROLES_INFO[key].icon} color={ROLES_INFO[key].color} label={ROLES_INFO[key].label} desc={ROLES_INFO[key].desc} onPress={()=>setRegRole(key)}/>
          ))}

          {regRole && (
            <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
              <Text style={[styles.cardTitle5D,{color:T.text}]}>Détails {ROLES_INFO[regRole].label}</Text>
              <TextInput value={regExtra} onChangeText={setRegExtra} placeholder={ROLES_INFO[regRole].champ} style={styles.input5D}/>
              {regRole==="pro" && (<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop:8}}>{PRO_DOMAINES.map(d=><TouchableOpacity key={d} style={[styles.cat5D,regDomaine===d&&styles.cat5DActive]} onPress={()=>setRegDomaine(d)}><Text style={regDomaine===d?styles.cat5DActiveT:styles.cat5DT}>{d}</Text></TouchableOpacity>)}</ScrollView>)}
            </View>
          )}

          {!!authError && <Text style={{color:"#e74c3c",marginTop:8,textAlign:"center"}}>{authError}</Text>}
          <TouchableOpacity style={styles.buy5D} onPress={startOtp} disabled={authLoading}>
            <Text style={styles.buy5DT}>{authLoading ? "Envoi du code... (jusqu'à 1 min la 1ère fois, le serveur se réveille)" : "Recevoir mon code par SMS"}</Text>
          </TouchableOpacity>
          </>
          ) : (
          <View style={[styles.card5DLarge,{backgroundColor:T.card, marginTop:16}]}>
            <Text style={[styles.cardTitle5D,{color:T.text}]}>Code envoyé au {regPhone}</Text>
            <Text style={styles.ruleD5D}>⚠️ SIMULATION TEST : aucun vrai SMS n'est encore envoyé. Le code ci-dessous a été rempli automatiquement pour tester.</Text>
            <TextInput value={otpCode} onChangeText={setOtpCode} placeholder="Code à 6 chiffres" keyboardType="number-pad" maxLength={6} style={styles.input5D}/>
            {!!authError && <Text style={{color:"#e74c3c",marginTop:8,textAlign:"center"}}>{authError}</Text>}
            <TouchableOpacity style={styles.buy5D} onPress={confirmOtp} disabled={authLoading}>
              <Text style={styles.buy5DT}>{authLoading ? "Vérification..." : `Valider (+${R.POINTS_INSCRIPTION} pts de bienvenue)`}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={backToAuthForm} style={{marginTop:10,alignSelf:"center"}}>
              <Text style={{color:T.text,opacity:0.7}}>← Modifier mes informations</Text>
            </TouchableOpacity>
          </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ================= HOME =================
  if(page==="home"){
    const ListHeader = (
      <View>
        <View style={[styles.header5D,{backgroundColor:T.card}]}>
          <View style={styles.headerLeft}>
            <Avatar user={user} size={44}/>
            <View><Text style={[styles.logo5D,{color:T.text}]}>MERCA</Text><Text style={styles.logoSub5D}>{user.guest?"Mode Invité":`Bonjour ${user.name.split(" ")[0]}`} • {getLevel()} {!user.guest&&`${points}pts`}</Text></View>
          </View>
          <TouchableOpacity style={styles.badge5D} onPress={()=>nav("settings")}><Text style={styles.badge5DT}>⚙️</Text></TouchableOpacity>
        </View>
        <Banner color={BANNERS.home.color} icon={BANNERS.home.icon} style={styles.hero5D} radius={24}>
          <View style={styles.hero5DOverlay}>
            <Text style={styles.hero5DTitle}>Yaoundé - Prix réel d'abord</Text>
            <Text style={styles.hero5DSub}>SIMULATION TEST - {R.SPLIT_LIVREUR}/{R.SPLIT_MARCHAND}/{R.SPLIT_MERCA}</Text>
            <View style={styles.search5D}><Text>🔎</Text><TextInput value={search} onChangeText={(t)=>{ setSearch(t); setShowAlternatives(false); }} placeholder="Tape produit exact..." placeholderTextColor="#999" style={styles.searchInput5D}/></View>
          </View>
        </Banner>
        {debouncedSearch!=='' && filteredExact.length>0 && !showAlternatives && (
          <View style={[styles.exactResult5D,{backgroundColor:T.card}]}>
            <Text style={styles.exactTitle}>✅ Produit trouvé - Prix réel d'abord</Text>
            {filteredExact.slice(0,1).map(p=>{ const com=Math.round(p.price*R.FRAIS); return (
              <View key={p.id} style={styles.exactCard5D}><Image source={{uri:p.img}} style={styles.exactImg}/><View style={{flex:1}}><Text style={styles.exactName}>{p.name}</Text><Text style={styles.exactPrice}>{money(p.price)} PRIX RÉEL</Text><Text style={styles.exactDetail}>Produit {money(p.price)} + 3,3% {money(com)} + Liv {R.BASE}F</Text></View></View>
            );})}
            <View style={{flexDirection:'row',gap:8,marginTop:10}}>
              <TouchableOpacity style={styles.btnPrimary5D} onPress={()=>{ setSelected(filteredExact[0]); nav("product"); }}><Text style={styles.btnPrimary5DT}>Voir produit</Text></TouchableOpacity>
              {!user.guest && <TouchableOpacity style={styles.btnSecondary5D} onPress={()=>setShowAlternatives(true)}><Text style={styles.btnSecondary5DT}>Alternatives</Text></TouchableOpacity>}
            </View>
          </View>
        )}
        {user.guest && debouncedSearch==='' && (
          <View style={styles.security5D}><Text style={styles.securityText5D}>🔒 Mode invité : tape le nom exact d'un produit pour le trouver. La navigation par catégories et les alternatives sont réservées aux comptes inscrits.</Text></View>
        )}
        {!user.guest && (debouncedSearch==='' || showAlternatives) && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginVertical:12}}>{CATS.map(c=><TouchableOpacity key={c} style={[styles.cat5D,cat===c&&styles.cat5DActive]} onPress={()=>setCat(c)}><Text style={cat===c?styles.cat5DActiveT:styles.cat5DT}>{c}</Text></TouchableOpacity>)}</ScrollView>
            <Text style={[styles.section5D,{color:T.text}]}>✨ Catalogue</Text>
          </>
        )}
      </View>
    );
    const ListFooter = (
      <View>
        <TouchableOpacity style={styles.serviceBanner5D} onPress={()=>nav("services")}>
          <Banner color={BANNERS.services.color} icon={BANNERS.services.icon} style={styles.gridImg5D} radius={18}><View style={styles.gridOverlay5D}><Text style={styles.gridTitle5D}>🧑‍💼 SERVICES PRO</Text><Text style={styles.gridSub5D}>Juridique, beauté, réparation, éducation...</Text></View></Banner>
        </TouchableOpacity>
        <View style={styles.grid5D}>
          <TouchableOpacity style={styles.gridItem5D} onPress={()=>nav("client")}><Banner color={BANNERS.client.color} icon={BANNERS.client.icon} style={styles.gridImg5D} radius={18}><View style={styles.gridOverlay5D}><Text style={styles.gridTitle5D}>👤 CLIENT</Text><Text style={styles.gridSub5D}>{user.guest?"Invité":`${points}pts`}</Text></View></Banner></TouchableOpacity>
          <TouchableOpacity style={styles.gridItem5D} onPress={()=>nav("espaces")}><Banner color={BANNERS.merchant.color} icon={BANNERS.merchant.icon} style={styles.gridImg5D} radius={18}><View style={styles.gridOverlay5D}><Text style={styles.gridTitle5D}>🧰 ESPACE</Text><Text style={styles.gridSub5D}>Vendre / Livrer</Text></View></Banner></TouchableOpacity>
          <TouchableOpacity style={styles.gridItem5D} onPress={()=>user.guest?requireAccount("accéder à PERMUTA"):nav("permuta")}><Banner color={BANNERS.permuta.color} icon={BANNERS.permuta.icon} style={styles.gridImg5D} radius={18}><View style={styles.gridOverlay5D}><Text style={styles.gridTitle5D}>🔄 PERMUTA {user.guest?"🔒":""}</Text><Text style={styles.gridSub5D}>Simulation test</Text></View></Banner></TouchableOpacity>
          <TouchableOpacity style={styles.gridItem5D} onPress={()=>nav("settings")}><Banner color={BANNERS.settings.color} icon={BANNERS.settings.icon} style={styles.gridImg5D} radius={18}><View style={styles.gridOverlay5D}><Text style={styles.gridTitle5D}>⚙️ PARAMÈTRES</Text><Text style={styles.gridSub5D}>Compte, rôles, PIN</Text></View></Banner></TouchableOpacity>
        </View>
      </View>
    );
    const renderProduct=({item:p})=>{
      const com=Math.round(p.price*R.FRAIS); const tot=p.price+R.BASE+com; const bloq=Date.now()-p.last<R.BLOQUE*86400000; const fav=favorites.includes(p.id);
      return (
        <TouchableOpacity style={[styles.card5D,{backgroundColor:T.card}]} onPress={()=>{ setSelected(p); nav("product"); }}>
          <Image source={{uri:p.img}} style={styles.card5DImg}/>
          <View style={styles.card5DBody}>
            <View style={styles.shopRow5D}><Image source={{uri:IMG.boutique}} style={styles.shopAvatar5D}/><Text style={styles.shopName5D}>{p.shop} • {p.rayon}km</Text></View>
            <Text style={[styles.productName5D,{color:T.text}]}>{p.name}</Text>
            <View style={styles.priceBlock5D}>
              <Text style={styles.productPrice5D}>Produit: {money(p.price)} PRIX RÉEL</Text>
              <Text style={styles.comPrice5D}>Com 3,3% = {money(com)}</Text>
              <Text style={styles.totalPrice5D}>Total {money(tot)}</Text>
            </View>
            {p.stock<=0 && <View style={styles.lock5D}><Text style={styles.lock5DT}>❌ Rupture de stock</Text></View>}
          </View>
          <TouchableOpacity onPress={()=>toggleFavorite(p.id)} style={styles.favBtn5D}><Text style={{fontSize:16}}>{fav?"❤️":"🤍"}</Text></TouchableOpacity>
        </TouchableOpacity>
      );
    };
    return (
      <SafeAreaView style={[styles.container,{backgroundColor:T.bg}]}>
        <FlatList data={user.guest ? (debouncedSearch!==''?filteredExact:[]) : ((debouncedSearch===''||showAlternatives)?filtered:[])} keyExtractor={(item)=>item.id} renderItem={renderProduct} ListHeaderComponent={ListHeader} ListFooterComponent={ListFooter} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} initialNumToRender={8} windowSize={5}/>
        <Bottom5D goHome={home} nav={nav} page={page} orders={orders} bookings={bookings}/>
      </SafeAreaView>
    );
  }

  if(page==="product"&&selected){
    const com=Math.round(selected.price*R.FRAIS); const tot=selected.price+R.BASE+com; const rating=avgRating(selected.shop);
    return (<Page title="Produit" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <ImageBackground source={{uri:selected.img}} style={styles.detailHero5D} imageStyle={{borderRadius:24}}><View style={styles.detailOverlay5D}><Text style={styles.detailName5D}>{selected.name}</Text><Text style={styles.detailPriceReal5D}>{money(selected.price)} PRIX RÉEL</Text></View></ImageBackground>
      {rating && <Text style={styles.ratingLine5D}>⭐ {rating.avg}/5 ({rating.count} avis) — {selected.shop}</Text>}
      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
        <View style={styles.separationBlock}>
          <View style={styles.sepRow}><Text style={styles.sepLabel}>Produit</Text><Text style={styles.sepValue}>{money(selected.price)}</Text></View>
          <View style={styles.sepRow}><Text style={styles.sepLabel}>Commission 3,3%</Text><Text style={styles.sepValueCom}>{money(com)}</Text></View>
          <View style={styles.sepRow}><Text style={styles.sepLabel}>Livraison {R.BASE}F</Text><Text style={styles.sepValueLiv}>{R.SPLIT_LIVREUR}+{R.SPLIT_MARCHAND}+{R.SPLIT_MERCA}</Text></View>
          <View style={[styles.sepRow,styles.sepTotal]}><Text style={styles.sepLabelTotal}>Total</Text><Text style={styles.sepValueTotal}>{money(tot)}</Text></View>
        </View>
      </View>
      {selected.stock>0 ? <TouchableOpacity style={styles.buy5D} onPress={()=>user.guest?requireAccount("commander"):nav("checkout")}><Text style={styles.buy5DT}>Commander - SIMULATION</Text></TouchableOpacity> : <View style={styles.lock5D}><Text style={styles.lock5DT}>❌ Rupture de stock</Text></View>}
    </Page>);
  }

  if(page==="checkout"){
    const com=selected?Math.round(selected.price*R.FRAIS):0; const tot=selected?selected.price+R.BASE+com:0;
    return (<Page title="Checkout" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <View style={styles.security5D}><Text style={styles.securityTitle5D}>🧪 SIMULATION TEST</Text><Text style={styles.securityText5D}>PIN {walletPin} - Escrow simulé</Text></View>
      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}><View style={{flexDirection:'row',gap:12}}><Image source={{uri:selected?.img}} style={styles.checkoutImg5D}/><View style={{flex:1}}><Text style={[styles.cardTitle5D,{color:T.text}]}>{selected?.name}</Text><Text style={styles.checkoutTotal5D}>Total {money(tot)}</Text></View></View></View>
      <TouchableOpacity style={styles.buy5D} onPress={()=>confirm("Confirmer",`Payer ${money(tot)} ?`,()=>createOrder(selected,"Livraison MERCA"))}><Text style={styles.buy5DT}>🚚 Livraison {money(tot)}</Text></TouchableOpacity>
      <TouchableOpacity style={styles.secondary5D} onPress={()=>confirm("Retrait",`Retrait ${money(selected.price)} ?`,()=>createOrder(selected,"Retrait boutique"))}><Text style={styles.secondary5DT}>🏪 Retrait boutique</Text></TouchableOpacity>
    </Page>);
  }

  if(page==="wallet"){
    if(user.guest) return <RoleGate T={T} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} info={{icon:"💳",label:"Wallet",desc:"Le portefeuille est réservé aux comptes inscrits"}} onActivate={()=>setUser(null)} actionLabel="S'inscrire"/>;
    return (<Page title="Wallet" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <Banner color={BANNERS.wallet.color} icon={BANNERS.wallet.icon} style={styles.walletHero5D} radius={24}><View style={styles.walletOverlay5D}><Text style={styles.walletLabel5D}>SIMULATION TEST</Text><Text style={styles.walletBalance5D}>{money(wallet)}</Text><Text style={styles.walletSub5D}>{points}pts • {getLevel()}</Text></View></Banner>
      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
        <Text style={[styles.cardTitle5D,{color:T.text}]}>🔐 Déverrouiller (PIN)</Text>
        <TextInput value={pinInput} onChangeText={setPinInput} placeholder="PIN" secureTextEntry keyboardType="numeric" maxLength={4} style={styles.input5D}/>
        <TouchableOpacity style={styles.buy5D} onPress={()=>{
          if(Date.now()<blocked) return Alert.alert("Bloqué","Réessaie plus tard (simulation)");
          if(pinInput!==walletPin){ const f=fails+1; if(f>=3){ setBlocked(Date.now()+300000); setFails(0); Alert.alert("Bloqué 5min"); } else { setFails(f); Alert.alert(`Reste ${3-f} essai(s)`); } return; }
          setFails(0); setPinInput(""); Alert.alert("Débloqué - SIMULATION");
        }}><Text style={styles.buy5DT}>Débloquer</Text></TouchableOpacity>
      </View>
      {walletHistory.map(h=>(<View key={h.id} style={[styles.history5D,{backgroundColor:T.card}]}><View style={[styles.historyIcon5D,{backgroundColor:h.color+"20"}]}><Text>{h.icon}</Text></View><View style={{flex:1}}><Text style={[styles.historyTitle5D,{color:T.text}]}>{h.type}</Text></View><Text style={[styles.historyAmount5D,{color:h.color}]}>{h.amount!==0?money(h.amount):''}</Text></View>))}
    </Page>);
  }

  // ---- Espace pro (choix boutique/livraison/bureau) ----
  if(page==="espaces"){
    if(user.guest) return <RoleGate T={T} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} info={{icon:"🧰",label:"Espace",desc:"Vendre ou livrer nécessite un compte inscrit"}} onActivate={()=>setUser(null)} actionLabel="S'inscrire"/>;
    return (<Page title="Mon Espace" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <Text style={styles.ruleD5D}>Un espace grisé veut dire que ce rôle n'est pas encore activé — active-le depuis les Paramètres.</Text>
      <EspaceCard T={T} active={hasRole("commercant")} icon={ROLES_INFO.commercant.icon} color={ROLES_INFO.commercant.color} title="Boutique (Commerçant)" desc="Vendre des produits" onPress={()=>hasRole("commercant")?nav("merchant"):nav("settings")}/>
      <EspaceCard T={T} active={hasRole("livreur")} icon={ROLES_INFO.livreur.icon} color={ROLES_INFO.livreur.color} title="Livraison" desc={`${R.SPLIT_LIVREUR}F + ${R.BONUS_LIVRAISON}pts`} onPress={()=>hasRole("livreur")?nav("courier"):nav("settings")}/>
      <EspaceCard T={T} active={hasRole("pro")} icon={ROLES_INFO.pro.icon} color={ROLES_INFO.pro.color} title="Bureau Pro" desc="Vendre un service" onPress={()=>hasRole("pro")?nav("pro"):nav("settings")}/>
    </Page>);
  }

  if(page==="merchant"){
    if(!hasRole("commercant")) return <RoleGate T={T} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} info={ROLES_INFO.commercant} onActivate={()=>nav("settings")} actionLabel="Activer dans les Paramètres"/>;
    const my=products.filter(p=>p.shop===user.shopName); const rating=avgRating(user.shopName);
    return (<Page title={`Boutique - ${R.BLOQUE}j`} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <Banner color={BANNERS.merchant.color} icon={BANNERS.merchant.icon} style={styles.spaceHero5D} radius={22}><View style={styles.spaceOverlay5D}><Text style={styles.spaceTitle5D}>🏪 {user.shopName} {isVerified("commercant")?"✅":""}</Text><Text style={styles.spaceSub5D}>{rating?`⭐ ${rating.avg}/5 (${rating.count} avis)`:"Pas encore d'avis"}</Text></View></Banner>
      <TouchableOpacity style={[styles.add5D,{backgroundColor:T.card}]} onPress={()=>setShowAdd(true)}><Image source={{uri:IMG.boutique}} style={styles.addImg5D}/><View style={{flex:1}}><Text style={[styles.addT5D,{color:T.text}]}>＋ Ajouter produit</Text></View></TouchableOpacity>
      <View style={[styles.security5D,{marginBottom:12}]}><Text style={styles.securityTitle5D}>📈 Publicité Facebook/Instagram</Text><Text style={styles.securityText5D}>Appuie sur "📤 Partager" sur un produit, puis dans Facebook/Instagram, choisis "Booster cette publication" pour toucher plus de clients (budget et paiement gérés directement par toi sur Facebook).</Text></View>
      {my.map(p=>{ const bloq=Date.now()-p.last<R.BLOQUE*86400000; return (
        <View key={p.id} style={[styles.myProd5D,{backgroundColor:T.card}]}><Image source={{uri:p.img}} style={styles.myProdImg5D}/><View style={{flex:1}}><Text style={[styles.myProdName5D,{color:T.text}]}>{p.name} {bloq?`🔒 ${R.BLOQUE}j`:''}</Text><Text style={styles.myProdPrice5D}>Prix {money(p.price)} • Stock {p.stock}</Text></View><TouchableOpacity onPress={()=>shareProduct(p)} style={styles.editBtn5D}><Text style={styles.editBtn5DT}>📤 Partager</Text></TouchableOpacity><TouchableOpacity onPress={()=>openEdit(p)} style={styles.editBtn5D}><Text style={styles.editBtn5DT}>✏️ Modifier</Text></TouchableOpacity></View>
      );})}

      <Text style={[styles.section5D,{color:T.text}]}>📦 Commandes reçues</Text>
      {incomingOrders.length===0 && <Text style={styles.settingsSub}>Aucune commande pour le moment.</Text>}
      {incomingOrders.map(o=>(
        <View key={o.id} style={[styles.myProd5D,{backgroundColor:T.card}]}>
          <View style={{flex:1}}><Text style={[styles.myProdName5D,{color:T.text}]}>{o.product.name} • Code {o.codeLivraison}</Text><Text style={styles.myProdPrice5D}>{o.status} • {money(o.total)}</Text></View>
          {o.step<=1 && <TouchableOpacity onPress={()=>doAdvance(o, refreshIncomingOrders)} style={styles.editBtn5D}><Text style={styles.editBtn5DT}>➜ Étape suivante</Text></TouchableOpacity>}
        </View>
      ))}
      <Modal visible={showAdd} transparent animationType="slide"><View style={styles.modalBg5D}><View style={styles.modal5D}>
        <Text style={styles.modalTitle5D}>＋ Nouveau produit</Text>
        <TextInput value={npName} onChangeText={setNpName} placeholder="Nom" style={styles.input5D}/>
        <TextInput value={npPrice} onChangeText={setNpPrice} placeholder="Prix (FCFA)" keyboardType="numeric" style={styles.input5D}/>
        <TextInput value={npStock} onChangeText={setNpStock} placeholder="Stock" keyboardType="numeric" style={styles.input5D}/>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8}}>{CATS.filter(c=>c!=="Tous").map(c=><TouchableOpacity key={c} style={[styles.cat5D,npCat===c&&styles.cat5DActive]} onPress={()=>setNpCat(c)}><Text style={npCat===c?styles.cat5DActiveT:styles.cat5DT}>{c}</Text></TouchableOpacity>)}</ScrollView>
        <TouchableOpacity style={styles.buy5D} onPress={createProd}><Text style={styles.buy5DT}>Publier</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary5D} onPress={()=>setShowAdd(false)}><Text>Annuler</Text></TouchableOpacity>
      </View></View></Modal>
      <Modal visible={!!showEdit} transparent animationType="slide"><View style={styles.modalBg5D}><View style={styles.modal5D}>
        <Text style={styles.modalTitle5D}>✏️ Modifier {showEdit?.name}</Text>
        <TextInput value={editPrice} onChangeText={setEditPrice} placeholder="Nouveau prix" keyboardType="numeric" style={styles.input5D}/>
        <TextInput value={editStock} onChangeText={setEditStock} placeholder="Nouveau stock" keyboardType="numeric" style={styles.input5D}/>
        <TouchableOpacity style={styles.buy5D} onPress={updateProd}><Text style={styles.buy5DT}>Enregistrer</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary5D} onPress={()=>setShowEdit(null)}><Text>Annuler</Text></TouchableOpacity>
      </View></View></Modal>
    </Page>);
  }

  // ---- Parcourir les services (client) ----
  if(page==="services"){
    return (<Page title="Services Pro" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <Banner color={BANNERS.services.color} icon={BANNERS.services.icon} style={styles.spaceHero5D} radius={22}><View style={styles.spaceOverlay5D}><Text style={styles.spaceTitle5D}>🧑‍💼 Tous les services disponibles</Text></View></Banner>
      {dispoServices.length===0 && <View style={styles.empty5D}><Text>Aucun service publié pour l'instant</Text></View>}
      {dispoServices.map(s=>{ const rating=avgRating(s.bureau); return (
        <TouchableOpacity key={s.id} style={[styles.card5D,{backgroundColor:T.card}]} onPress={()=>{ setSelectedService(s); nav("serviceDetail"); }}>
          <Image source={{uri:IMG.bureau}} style={styles.card5DImg}/>
          <View style={styles.card5DBody}>
            <Text style={styles.shopName5D}>{s.bureau} • {s.domaine}</Text>
            <Text style={[styles.productName5D,{color:T.text}]}>{s.name}</Text>
            <Text style={styles.productPrice5D}>{money(s.price)}{rating?` • ⭐ ${rating.avg}`:''}</Text>
          </View>
        </TouchableOpacity>
      );})}
    </Page>);
  }

  if(page==="serviceDetail" && selectedService){
    const rating=avgRating(selectedService.bureau);
    return (<Page title="Service" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
        <Text style={[styles.cardTitle5D,{color:T.text}]}>{selectedService.name}</Text>
        <Text style={styles.settingsSub}>{selectedService.bureau} • {selectedService.domaine} {rating?`• ⭐ ${rating.avg}/5 (${rating.count})`:''}</Text>
        <Text style={[styles.settingsLine,{color:T.text,marginTop:8}]}>{money(selectedService.price)}</Text>
        <Text style={styles.settingsSub}>{cleanDesc(selectedService.desc)}</Text>
      </View>
      <TouchableOpacity style={styles.buy5D} onPress={()=>user.guest?requireAccount("réserver ce service"):nav("bookingSlot")}><Text style={styles.buy5DT}>Réserver - SIMULATION</Text></TouchableOpacity>
    </Page>);
  }

  if(page==="bookingSlot" && selectedService){
    const slots=genSlots(); const com=Math.round(selectedService.price*R.FRAIS); const tot=selectedService.price+com;
    return (<Page title="Choisir un créneau" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}><Text style={[styles.cardTitle5D,{color:T.text}]}>{selectedService.name}</Text><Text style={styles.checkoutTotal5D}>Total {money(tot)}</Text></View>
      {slots.map(s=>(<TouchableOpacity key={s.id} style={[styles.slotBtn5D, selectedSlot?.id===s.id&&styles.slotBtnActive5D]} onPress={()=>setSelectedSlot(s)}><Text style={[styles.slotBtnT5D, selectedSlot?.id===s.id&&{color:"#fff"}]}>📅 {s.label}</Text></TouchableOpacity>))}
      <TouchableOpacity style={[styles.buy5D,!selectedSlot&&{opacity:0.4}]} disabled={!selectedSlot} onPress={()=>confirm("Confirmer la réservation",`Payer ${money(tot)} pour le créneau ${selectedSlot?.label} ?`,createBooking)}><Text style={styles.buy5DT}>Confirmer et payer</Text></TouchableOpacity>
    </Page>);
  }

  if(page==="bookingTracking"){
    return (<Page title="Ma réservation" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      {!selectedBooking ? <View style={styles.empty5D}><Text>Aucune réservation</Text></View> : (<>
        <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
          <Text style={[styles.cardTitle5D,{color:T.text}]}>{selectedBooking.service.name} - Code {selectedBooking.bookingCode}</Text>
          <Text style={styles.settingsSub}>{selectedBooking.slot.label} • {money(selectedBooking.total)}</Text>
        </View>
        <View style={[styles.timeline5D,{backgroundColor:T.card}]}>{BOOKING_STEPS.map((s,i)=>{ const act=i<=selectedBooking.step; return (<View key={s} style={styles.timeRow5D}><View style={[styles.timeCircle5D,act&&styles.timeActive5D]}><Text>{act?"✓":"•"}</Text></View><Text style={[styles.timeTitle5D,act&&styles.timeActiveTitle5D]}>{s}</Text></View>);})}</View>
        {selectedBooking.step<2 && <TouchableOpacity style={styles.secondary5D} onPress={()=>cancelBooking(selectedBooking)}><Text style={styles.secondary5DT}>Annuler la réservation</Text></TouchableOpacity>}
        {selectedBooking.step===2 && <TouchableOpacity style={styles.buy5D} onPress={()=>openReview(selectedBooking.service.bureau, selectedBooking.id)}><Text style={styles.buy5DT}>⭐ Laisser un avis</Text></TouchableOpacity>}
        <TouchableOpacity style={styles.secondary5D} onPress={()=>{ setSupportThread(selectedBooking.id); nav("support"); }}><Text style={styles.secondary5DT}>💬 Support / Signaler un problème</Text></TouchableOpacity>
      </>)}
      <ReviewModal visible={!!reviewModal} rating={reviewRating} setRating={setReviewRating} comment={reviewComment} setComment={setReviewComment} onCancel={()=>setReviewModal(null)} onSubmit={submitReview}/>
    </Page>);
  }

  // ---- Bureau Pro ----
  if(page==="pro"){
    if(!hasRole("pro")) return <RoleGate T={T} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} info={ROLES_INFO.pro} onActivate={()=>nav("settings")} actionLabel="Activer dans les Paramètres"/>;
    const my=services.filter(s=>s.bureau===user.bureau); const myBookings=bookings.filter(b=>b.service.bureau===user.bureau); const rating=avgRating(user.bureau);
    return (<Page title={`Bureau Pro - ${R.BLOQUE}j`} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <Banner color={BANNERS.pro.color} icon={BANNERS.pro.icon} style={styles.spaceHero5D} radius={22}><View style={styles.spaceOverlay5D}><Text style={styles.spaceTitle5D}>🧑‍💼 {user.bureau} {isVerified("pro")?"✅":""}</Text><Text style={styles.spaceSub5D}>{user.domaine} • {rating?`⭐ ${rating.avg}/5 (${rating.count} avis)`:"Pas encore d'avis"}</Text></View></Banner>

      {myBookings.length>0 && (<><Text style={[styles.section5D,{color:T.text}]}>📅 Mes réservations</Text>
        {myBookings.map(b=>(<View key={b.id} style={[styles.myProd5D,{backgroundColor:T.card}]}>
          <View style={{flex:1}}><Text style={[styles.myProdName5D,{color:T.text}]}>{b.service.name} - {b.slot.label}</Text><Text style={styles.myProdPrice5D}>Code {b.bookingCode} • {b.status}</Text></View>
          {b.status==="Demande envoyée" && <TouchableOpacity onPress={()=>proConfirmBooking(b)} style={styles.editBtn5D}><Text style={styles.editBtn5DT}>Confirmer</Text></TouchableOpacity>}
          {b.status==="Confirmée" && <TouchableOpacity onPress={()=>proCompleteBooking(b)} style={styles.editBtn5D}><Text style={styles.editBtn5DT}>Terminer</Text></TouchableOpacity>}
        </View>))}
      </>)}

      <Text style={[styles.section5D,{color:T.text}]}>Mes services</Text>
      <TouchableOpacity style={[styles.add5D,{backgroundColor:T.card}]} onPress={()=>setShowAddService(true)}><Image source={{uri:IMG.bureau}} style={styles.addImg5D}/><View style={{flex:1}}><Text style={[styles.addT5D,{color:T.text}]}>＋ Ajouter un service</Text></View></TouchableOpacity>
      <View style={[styles.security5D,{marginBottom:12}]}><Text style={styles.securityTitle5D}>📈 Publicité Facebook/Instagram</Text><Text style={styles.securityText5D}>Appuie sur "📤 Partager" sur un service, puis dans Facebook/Instagram, choisis "Booster cette publication" pour toucher plus de clients (budget et paiement gérés directement par toi sur Facebook).</Text></View>
      {my.map(s=>{ const bloq=Date.now()-s.last<R.BLOQUE*86400000; return (
        <View key={s.id} style={[styles.myProd5D,{backgroundColor:T.card}]}>
          <Image source={{uri:IMG.bureau}} style={styles.myProdImg5D}/>
          <View style={{flex:1}}><Text style={[styles.myProdName5D,{color:T.text}]}>{s.name} {bloq?`🔒 ${R.BLOQUE}j`:''}</Text><Text style={styles.myProdPrice5D}>{s.domaine} • Tarif {money(s.price)} • {s.dispo?"✅ Disponible":"⏸ Indisponible"}</Text></View>
          <View style={{gap:6}}><TouchableOpacity onPress={()=>shareService(s)} style={styles.editBtn5D}><Text style={styles.editBtn5DT}>📤 Partager</Text></TouchableOpacity><TouchableOpacity onPress={()=>openEditService(s)} style={styles.editBtn5D}><Text style={styles.editBtn5DT}>✏️ Tarif</Text></TouchableOpacity><TouchableOpacity onPress={()=>toggleDispo(s.id)} style={styles.editBtn5D}><Text style={styles.editBtn5DT}>{s.dispo?"⏸ Pause":"▶️ Activer"}</Text></TouchableOpacity></View>
        </View>
      );})}
      <Modal visible={showAddService} transparent animationType="slide"><View style={styles.modalBg5D}><View style={styles.modal5D}>
        <Text style={styles.modalTitle5D}>＋ Nouveau service</Text>
        <TextInput value={nsName} onChangeText={setNsName} placeholder="Nom du service" style={styles.input5D}/>
        <TextInput value={nsPrice} onChangeText={setNsPrice} placeholder="Tarif (FCFA)" keyboardType="numeric" style={styles.input5D}/>
        <TextInput value={nsDesc} onChangeText={setNsDesc} placeholder="Description courte" style={styles.input5D}/>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8}}>{PRO_DOMAINES.map(d=><TouchableOpacity key={d} style={[styles.cat5D,nsDomaine===d&&styles.cat5DActive]} onPress={()=>setNsDomaine(d)}><Text style={nsDomaine===d?styles.cat5DActiveT:styles.cat5DT}>{d}</Text></TouchableOpacity>)}</ScrollView>
        <TouchableOpacity style={styles.buy5D} onPress={createService}><Text style={styles.buy5DT}>Publier</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary5D} onPress={()=>setShowAddService(false)}><Text>Annuler</Text></TouchableOpacity>
      </View></View></Modal>
      <Modal visible={!!showEditService} transparent animationType="slide"><View style={styles.modalBg5D}><View style={styles.modal5D}>
        <Text style={styles.modalTitle5D}>✏️ Modifier tarif</Text>
        <TextInput value={esPrice} onChangeText={setEsPrice} placeholder="Nouveau tarif" keyboardType="numeric" style={styles.input5D}/>
        <TouchableOpacity style={styles.buy5D} onPress={updateService}><Text style={styles.buy5DT}>Enregistrer</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary5D} onPress={()=>setShowEditService(null)}><Text>Annuler</Text></TouchableOpacity>
      </View></View></Modal>
    </Page>);
  }

  if(page==="tracking"){
    return (<Page title="Suivi" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      {!selectedOrder ? <View style={styles.empty5D}><Text>Aucune commande</Text></View> : (<>
        <View style={[styles.card5DLarge,{backgroundColor:T.card}]}><View style={{flexDirection:'row',gap:12}}><Image source={{uri:selectedOrder.product.img}} style={styles.checkoutImg5D}/><View style={{flex:1}}><Text style={[styles.cardTitle5D,{color:T.text}]}>{selectedOrder.product.name} - Code {selectedOrder.codeLivraison}</Text><Text style={styles.checkoutTotal5D}>Total {money(selectedOrder.total)}</Text></View></View></View>
        <View style={[styles.timeline5D,{backgroundColor:T.card}]}>{STEPS.map((s,i)=>{ const act=i<=selectedOrder.step; return (<View key={s} style={styles.timeRow5D}><View style={[styles.timeCircle5D,act&&styles.timeActive5D]}><Text>{act?"✓":"•"}</Text></View><Text style={[styles.timeTitle5D,act&&styles.timeActiveTitle5D]}>{s}</Text></View>);})}</View>
        {selectedOrder.step<4 && <Text style={[styles.settingsSub,{textAlign:"center",marginTop:8}]}>⏳ En attente du commerçant/livreur pour la prochaine étape</Text>}
        {selectedOrder.step===4 && selectedOrder.status!=="Confirmée" && <TouchableOpacity style={styles.buy5D} onPress={()=>confirmReception(selectedOrder)}><Text style={styles.buy5DT}>✅ Confirmer réception</Text></TouchableOpacity>}
        {selectedOrder.status==="Confirmée" && <TouchableOpacity style={styles.buy5D} onPress={()=>openReview(selectedOrder.merchant, selectedOrder.id)}><Text style={styles.buy5DT}>⭐ Laisser un avis</Text></TouchableOpacity>}
        <TouchableOpacity style={styles.secondary5D} onPress={()=>{ setSupportThread(selectedOrder.id); nav("support"); }}><Text style={styles.secondary5DT}>💬 Support / Signaler un problème</Text></TouchableOpacity>
      </>)}
      <ReviewModal visible={!!reviewModal} rating={reviewRating} setRating={setReviewRating} comment={reviewComment} setComment={setReviewComment} onCancel={()=>setReviewModal(null)} onSubmit={submitReview}/>
    </Page>);
  }

  // ---- Support (messagerie + litige), commun aux commandes et réservations ----
  if(page==="support"){
    const msgs=threadMessages(supportThread);
    return (<Page title="Support" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <View style={[styles.card5DLarge,{backgroundColor:T.card,maxHeight:300}]}>
        {msgs.length===0 && <Text style={styles.settingsSub}>Aucun message. Écris ici en cas de question sur cette commande/réservation.</Text>}
        {msgs.map(m=>(<View key={m.id} style={[styles.msgBubble5D, m.from==="client"?styles.msgClient5D:styles.msgVendor5D]}><Text style={[styles.msgText5D, m.from!=="client"&&{color:"#111"}]}>{m.text}</Text></View>))}
      </View>
      <View style={{flexDirection:"row",gap:8}}>
        <TextInput value={messageInput} onChangeText={setMessageInput} placeholder="Écrire un message..." style={[styles.input5D,{flex:1,marginTop:0}]}/>
        <TouchableOpacity style={styles.sendBtn5D} onPress={sendMessage}><Text style={{color:"#fff",fontWeight:"800"}}>➤</Text></TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.dangerBtn5D} onPress={()=>setShowDisputeForm(true)}><Text style={styles.dangerBtn5DT}>⚠️ Signaler un problème</Text></TouchableOpacity>
      {disputes.filter(d=>d.threadId===supportThread).map(d=>(<View key={d.id} style={[styles.history5D,{backgroundColor:T.card}]}><View style={{flex:1}}><Text style={[styles.historyTitle5D,{color:T.text}]}>{d.reason}</Text><Text style={styles.settingsSub}>{d.description}</Text></View><Text style={styles.roleBadge5DT}>{d.status}</Text></View>))}
      <Modal visible={showDisputeForm} transparent animationType="slide"><View style={styles.modalBg5D}><View style={styles.modal5D}>
        <Text style={styles.modalTitle5D}>⚠️ Signaler un problème</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8}}>{DISPUTE_REASONS.map(r=><TouchableOpacity key={r} style={[styles.cat5D,disputeReason===r&&styles.cat5DActive]} onPress={()=>setDisputeReason(r)}><Text style={disputeReason===r?styles.cat5DActiveT:styles.cat5DT}>{r}</Text></TouchableOpacity>)}</ScrollView>
        <TextInput value={disputeDesc} onChangeText={setDisputeDesc} placeholder="Décris le problème" multiline style={[styles.input5D,{height:80}]}/>
        <TouchableOpacity style={styles.buy5D} onPress={submitDispute}><Text style={styles.buy5DT}>Envoyer</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary5D} onPress={()=>setShowDisputeForm(false)}><Text>Annuler</Text></TouchableOpacity>
      </View></View></Modal>
    </Page>);
  }

  if(page==="client"){
    const favProducts = products.filter(p=>favorites.includes(p.id));
    return (<Page title={`Client - ${points}pts`} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <View style={[styles.spaceHero5D,{alignItems:"center",justifyContent:"center"}]}><Avatar user={user} size={72}/><Text style={[styles.spaceTitle5D,{color:"#111",marginTop:8}]}>{user.name}</Text><Text style={{color:"#555",fontSize:11}}>{user.city} • {user.phone}</Text></View>
      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
        <Text style={[styles.cardTitle5D,{color:T.text}]}>Rôles actifs</Text>
        <View style={{flexDirection:"row",flexWrap:"wrap",gap:6,marginTop:8}}>{user.roles.map(r=>(<RoleBadge key={r} info={ROLES_INFO[r]} verified={isVerified(r)}/>))}</View>
      </View>
      {favProducts.length>0 && (<><Text style={[styles.section5D,{color:T.text}]}>❤️ Mes favoris</Text>
        {favProducts.map(p=>(<TouchableOpacity key={p.id} style={[styles.card5D,{backgroundColor:T.card}]} onPress={()=>{ setSelected(p); nav("product"); }}><Image source={{uri:p.img}} style={styles.card5DImg}/><View style={styles.card5DBody}><Text style={[styles.productName5D,{color:T.text}]}>{p.name}</Text><Text style={styles.productPrice5D}>{money(p.price)}</Text></View></TouchableOpacity>))}
      </>)}
      <Text style={[styles.section5D,{color:T.text}]}>📦 Mes commandes</Text>
      <FlatList data={orders} keyExtractor={(o)=>o.id} scrollEnabled={false} renderItem={({item:o})=>(<TouchableOpacity style={[styles.card5D,{backgroundColor:T.card}]} onPress={()=>{ setSelectedOrder(o); nav("tracking"); }}><View style={{flexDirection:'row',gap:10}}><Image source={{uri:o.product.img}} style={styles.orderImg5D}/><View style={{flex:1}}><Text style={[styles.cardTitle5D,{color:T.text}]}>{o.product.name} • Code {o.codeLivraison}</Text></View></View></TouchableOpacity>)}/>
      <Text style={[styles.section5D,{color:T.text}]}>📅 Mes réservations</Text>
      <FlatList data={bookings} keyExtractor={(b)=>b.id} scrollEnabled={false} renderItem={({item:b})=>(<TouchableOpacity style={[styles.card5D,{backgroundColor:T.card}]} onPress={()=>{ setSelectedBooking(b); nav("bookingTracking"); }}><View style={{flex:1}}><Text style={[styles.cardTitle5D,{color:T.text}]}>{b.service.name} • Code {b.bookingCode}</Text><Text style={styles.settingsSub}>{b.status}</Text></View></TouchableOpacity>)}/>
    </Page>);
  }

  if(page==="courier"){
    if(!hasRole("livreur")) return <RoleGate T={T} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} info={ROLES_INFO.livreur} onActivate={()=>nav("settings")} actionLabel="Activer dans les Paramètres"/>;
    return (<Page title={`Livreur - ${R.SPLIT_LIVREUR}F`} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <Banner color={BANNERS.courier.color} icon={BANNERS.courier.icon} style={styles.spaceHero5D} radius={22}><View style={styles.spaceOverlay5D}><Text style={styles.spaceTitle5D}>🚚 {user.vehicule} {isVerified("livreur")?"✅":""}</Text><Text style={styles.spaceSub5D}>{R.SPLIT_LIVREUR}F + {R.BONUS_LIVRAISON}pts par livraison confirmée</Text></View></Banner>
      <Text style={[styles.section5D,{color:T.text}]}>📦 Livraisons disponibles</Text>
      {availableDeliveries.length===0 && <Text style={styles.settingsSub}>Aucune livraison disponible pour l'instant.</Text>}
      {availableDeliveries.map(o=>(<View key={o.id} style={[styles.delivery5D,{backgroundColor:T.card}]}><Text style={[styles.deliveryTitle5D,{color:T.text}]}>{o.product.name} - Code {o.codeLivraison}</Text><TouchableOpacity style={styles.buy5D} onPress={()=>doAdvance(o, async()=>{ await refreshAvailableDeliveries(); await refreshMyDeliveries(); })}><Text style={styles.buy5DT}>Prendre - {R.SPLIT_LIVREUR}F</Text></TouchableOpacity></View>))}
      <Text style={[styles.section5D,{color:T.text}]}>🚚 Mes livraisons en cours</Text>
      {myDeliveries.filter(o=>o.step<4).length===0 && <Text style={styles.settingsSub}>Aucune livraison en cours.</Text>}
      {myDeliveries.filter(o=>o.step<4).map(o=>(<View key={o.id} style={[styles.delivery5D,{backgroundColor:T.card}]}><Text style={[styles.deliveryTitle5D,{color:T.text}]}>{o.product.name} - Code {o.codeLivraison}</Text><Text style={styles.settingsSub}>{o.status}</Text><TouchableOpacity style={styles.buy5D} onPress={()=>doAdvance(o, refreshMyDeliveries)}><Text style={styles.buy5DT}>✅ Marquer livrée</Text></TouchableOpacity></View>))}
    </Page>);
  }

  if(page==="permuta"){
    return (<Page title="PERMUTA" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <Banner color={BANNERS.permuta.color} icon={BANNERS.permuta.icon} style={styles.spaceHero5D} radius={22}><View style={styles.spaceOverlay5D}><Text style={styles.spaceTitle5D}>🔄 PERMUTA - SIMULATION TEST</Text></View></Banner>
      {permuta.map(it=>(<View key={it.id} style={[styles.permutaCard5D,{backgroundColor:T.card}]}><View style={styles.permutaRow5D}><Image source={{uri:it.img1}} style={styles.permutaImg5D}/><Text>🔄</Text><Image source={{uri:it.img2}} style={styles.permutaImg5D}/></View><Text style={[styles.permutaName5D,{color:T.text}]}>{it.name} - SIMULATION</Text></View>))}
    </Page>);
  }

  if(page==="orders"){
    return (<Page title="Commandes" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <FlatList data={orders} keyExtractor={(o)=>o.id} scrollEnabled={false} renderItem={({item:o})=>(<TouchableOpacity style={[styles.card5D,{backgroundColor:T.card}]} onPress={()=>{ setSelectedOrder(o); nav("tracking"); }}><View style={{flexDirection:'row',gap:10}}><Image source={{uri:o.product.img}} style={styles.orderImg5D}/><View style={{flex:1}}><Text style={[styles.cardTitle5D,{color:T.text}]}>{o.product.name} • Code {o.codeLivraison}</Text><Text style={styles.fidelity5D}>Total {money(o.total)}</Text></View></View></TouchableOpacity>)}/>
    </Page>);
  }

  // ================= PARAMÈTRES =================
  if(page==="settings"){
    const missingRoles = Object.keys(ROLES_INFO).filter(r=>r!=="client" && !hasRole(r));
    const verifiableRoles = (user.roles||[]).filter(r=>r!=="client" && !isVerified(r));
    return (<Page title="Paramètres" back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
      <View style={[styles.card5DLarge,{backgroundColor:T.card, alignItems:"center"}]}>
        <Avatar user={user} size={80}/>
        <TouchableOpacity style={styles.secondary5D} onPress={pickAvatar}><Text style={styles.secondary5DT}>📷 Changer ma photo de profil</Text></TouchableOpacity>
        <Text style={styles.settingsSub}>Utilisée dans toute l'app (pas l'icône du téléphone — voir note ci-dessous)</Text>
      </View>

      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
        <Text style={[styles.cardTitle5D,{color:T.text}]}>👤 Mon compte</Text>
        <Text style={[styles.settingsLine,{color:T.text}]}>{user.name}</Text>
        <Text style={styles.settingsSub}>{user.phone||"Pas de numéro (invité)"} • {user.city}</Text>
        {!user.guest && <TouchableOpacity style={styles.secondary5D} onPress={openAccountEdit}><Text style={styles.secondary5DT}>Modifier mes informations</Text></TouchableOpacity>}
        {user.guest && <TouchableOpacity style={styles.buy5D} onPress={()=>setUser(null)}><Text style={styles.buy5DT}>Créer un compte complet</Text></TouchableOpacity>}
      </View>

      {!user.guest && (<>
      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
        <Text style={[styles.cardTitle5D,{color:T.text}]}>🎭 Mes rôles</Text>
        <View style={{flexDirection:"row",flexWrap:"wrap",gap:6,marginTop:8,marginBottom:10}}>{user.roles.map(r=>(<RoleBadge key={r} info={ROLES_INFO[r]} verified={isVerified(r)}/>))}</View>
        {missingRoles.map(r=>(<TouchableOpacity key={r} style={styles.secondary5D} onPress={()=>{ setRoleModal(r); setRoleExtra(""); }}><Text style={styles.secondary5DT}>{ROLES_INFO[r].icon} Devenir {ROLES_INFO[r].label}</Text></TouchableOpacity>))}
      </View>

      {verifiableRoles.length>0 && (
        <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
          <Text style={[styles.cardTitle5D,{color:T.text}]}>🛡 Vérification d'identité</Text>
          <Text style={styles.settingsSub}>Un badge ✅ rassure les autres utilisateurs. SIMULATION : dans une vraie version, un humain ou un service tiers doit contrôler le document.</Text>
          {verifiableRoles.map(r=>(<TouchableOpacity key={r} style={styles.secondary5D} onPress={()=>{ setKycModal(r); setKycDoc(""); }}><Text style={styles.secondary5DT}>Vérifier {ROLES_INFO[r].label}</Text></TouchableOpacity>))}
        </View>
      )}

      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
        <Text style={[styles.cardTitle5D,{color:T.text}]}>🔐 Sécurité</Text>
        <TouchableOpacity style={styles.secondary5D} onPress={()=>setShowPinChange(true)}><Text style={styles.secondary5DT}>Changer le code PIN du wallet</Text></TouchableOpacity>
      </View>
      </>)}

      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
        <Text style={[styles.cardTitle5D,{color:T.text}]}>🎨 Apparence</Text>
        <View style={styles.switchRow}><Text style={{color:T.text}}>Mode sombre</Text><Switch value={dark} onValueChange={setDark}/></View>
        <View style={styles.switchRow}><Text style={{color:T.text}}>Notifications (simulation)</Text><Switch value={notifEnabled} onValueChange={setNotifEnabled}/></View>
      </View>

      <View style={[styles.card5DLarge,{backgroundColor:T.card}]}>
        <Text style={[styles.cardTitle5D,{color:T.text}]}>ℹ️ À propos</Text>
        <Text style={styles.settingsSub}>MERCA V7 - SIMULATION TEST - Pas bancaire réel, pas de vrai SMS</Text>
        <Text style={styles.settingsSub}>L'icône de l'app sur ton téléphone (écran d'accueil) ne peut pas être remplacée par une photo libre depuis l'app elle-même — c'est une restriction d'iOS et Android, pas une limite de MERCA. Ta photo de profil ci-dessus fonctionne partout dans l'app.</Text>
      </View>

      {!user.guest && <TouchableOpacity style={styles.secondary5D} onPress={logout}><Text style={styles.secondary5DT}>🚪 Déconnexion</Text></TouchableOpacity>}
      <TouchableOpacity style={styles.dangerBtn5D} onPress={resetAllData}><Text style={styles.dangerBtn5DT}>🗑 Réinitialiser toutes les données</Text></TouchableOpacity>

      <Modal visible={!!roleModal} transparent animationType="slide"><View style={styles.modalBg5D}><View style={styles.modal5D}>
        {roleModal && (<>
          <Text style={styles.modalTitle5D}>{ROLES_INFO[roleModal].icon} Devenir {ROLES_INFO[roleModal].label}</Text>
          <TextInput value={roleExtra} onChangeText={setRoleExtra} placeholder={ROLES_INFO[roleModal].champ} style={styles.input5D}/>
          {roleModal==="pro" && (<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8}}>{PRO_DOMAINES.map(d=><TouchableOpacity key={d} style={[styles.cat5D,roleDomaine===d&&styles.cat5DActive]} onPress={()=>setRoleDomaine(d)}><Text style={roleDomaine===d?styles.cat5DActiveT:styles.cat5DT}>{d}</Text></TouchableOpacity>)}</ScrollView>)}
          <TouchableOpacity style={styles.buy5D} onPress={confirmAddRole}><Text style={styles.buy5DT}>Activer ce rôle</Text></TouchableOpacity>
          <TouchableOpacity style={styles.secondary5D} onPress={()=>setRoleModal(null)}><Text>Annuler</Text></TouchableOpacity>
        </>)}
      </View></View></Modal>

      <Modal visible={!!kycModal} transparent animationType="slide"><View style={styles.modalBg5D}><View style={styles.modal5D}>
        <Text style={styles.modalTitle5D}>🛡 Vérification - {kycModal&&ROLES_INFO[kycModal].label}</Text>
        <TextInput value={kycDoc} onChangeText={setKycDoc} placeholder="Numéro de pièce d'identité (CNI)" style={styles.input5D}/>
        <TouchableOpacity style={styles.buy5D} onPress={submitKyc}><Text style={styles.buy5DT}>Envoyer</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary5D} onPress={()=>setKycModal(null)}><Text>Annuler</Text></TouchableOpacity>
      </View></View></Modal>

      <Modal visible={showAccountEdit} transparent animationType="slide"><View style={styles.modalBg5D}><View style={styles.modal5D}>
        <Text style={styles.modalTitle5D}>Modifier mes informations</Text>
        <TextInput value={accName} onChangeText={setAccName} placeholder="Nom" style={styles.input5D}/>
        <TextInput value={accPhone} onChangeText={setAccPhone} placeholder="Téléphone" keyboardType="phone-pad" style={styles.input5D}/>
        <TextInput value={accCity} onChangeText={setAccCity} placeholder="Ville" style={styles.input5D}/>
        <TouchableOpacity style={styles.buy5D} onPress={saveAccountEdit}><Text style={styles.buy5DT}>Enregistrer</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary5D} onPress={()=>setShowAccountEdit(false)}><Text>Annuler</Text></TouchableOpacity>
      </View></View></Modal>

      <Modal visible={showPinChange} transparent animationType="slide"><View style={styles.modalBg5D}><View style={styles.modal5D}>
        <Text style={styles.modalTitle5D}>Changer le PIN (4 chiffres)</Text>
        <TextInput value={newPin} onChangeText={setNewPin} placeholder="Nouveau PIN" secureTextEntry keyboardType="numeric" maxLength={4} style={styles.input5D}/>
        <TextInput value={newPinConfirm} onChangeText={setNewPinConfirm} placeholder="Confirmer le PIN" secureTextEntry keyboardType="numeric" maxLength={4} style={styles.input5D}/>
        <TouchableOpacity style={styles.buy5D} onPress={savePinChange}><Text style={styles.buy5DT}>Enregistrer</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary5D} onPress={()=>setShowPinChange(false)}><Text>Annuler</Text></TouchableOpacity>
      </View></View></Modal>
    </Page>);
  }

  return null;
}

// ---- Composants réutilisables ----

function Banner({color,icon,radius,style,children}){
  return (<View style={[style,{backgroundColor:color, borderRadius:radius||24, overflow:"hidden"}]}>
    <Text style={{position:"absolute", right:-14, bottom:-24, fontSize:120, opacity:0.16}}>{icon}</Text>
    {children}
  </View>);
}

function Avatar({user,size}){
  if(user?.avatarUri){
    return <Image source={{uri:user.avatarUri}} style={{width:size,height:size,borderRadius:size/2}}/>;
  }
  const initial = (user?.name||"?").trim().charAt(0).toUpperCase();
  return (<View style={{width:size,height:size,borderRadius:size/2,backgroundColor:"#111",alignItems:"center",justifyContent:"center"}}>
    <Text style={{color:"#fff",fontWeight:"900",fontSize:size*0.4}}>{initial}</Text>
  </View>);
}

function ReviewModal({visible,rating,setRating,comment,setComment,onCancel,onSubmit}){
  return (<Modal visible={visible} transparent animationType="slide"><View style={styles.modalBg5D}><View style={styles.modal5D}>
    <Text style={styles.modalTitle5D}>⭐ Laisser un avis</Text>
    <View style={{flexDirection:"row",justifyContent:"center",gap:8,marginVertical:12}}>
      {[1,2,3,4,5].map(n=>(<TouchableOpacity key={n} onPress={()=>setRating(n)}><Text style={{fontSize:30}}>{n<=rating?"⭐":"☆"}</Text></TouchableOpacity>))}
    </View>
    <TextInput value={comment} onChangeText={setComment} placeholder="Un commentaire (facultatif)" multiline style={[styles.input5D,{height:70}]}/>
    <TouchableOpacity style={styles.buy5D} onPress={onSubmit}><Text style={styles.buy5DT}>Envoyer mon avis</Text></TouchableOpacity>
    <TouchableOpacity style={styles.secondary5D} onPress={onCancel}><Text>Annuler</Text></TouchableOpacity>
  </View></View></Modal>);
}

function RoleBadge({info,verified}){
  return (<View style={[styles.roleBadge5D,{backgroundColor:info.color+"22",borderColor:info.color,borderWidth:1}]}>
    <Text style={[styles.roleBadge5DT,{color:info.color}]}>{info.icon} {info.label}{verified?" ✅":""}</Text>
  </View>);
}

function RoleCard({active,icon,color,label,desc,onPress}){
  return (<TouchableOpacity style={[styles.roleCard5D, active&&{borderColor:color, backgroundColor:color+"10"}]} onPress={onPress}>
    <View style={[styles.roleIconWrap5D,{backgroundColor:color}]}><Text style={{fontSize:22}}>{icon}</Text></View>
    <View style={{flex:1,marginLeft:12}}><Text style={styles.roleCard5DTitle}>{label}</Text><Text style={styles.roleCard5DDesc}>{desc}</Text></View>
    {active && <Text style={{fontSize:16,color}}>✓</Text>}
  </TouchableOpacity>);
}

function EspaceCard({T,active,icon,color,title,desc,onPress}){
  return (<TouchableOpacity style={[styles.espaceCard5D,{backgroundColor:T.card, opacity:active?1:0.55}]} onPress={onPress}>
    <View style={[styles.roleIconWrap5D,{backgroundColor:color,width:52,height:52,borderRadius:26}]}><Text style={{fontSize:26}}>{icon}</Text></View>
    <View style={{flex:1,marginLeft:12}}><Text style={[styles.cardTitle5D,{color:T.text}]}>{title}</Text><Text style={styles.settingsSub}>{active?desc:"Non activé — appuie pour l'activer dans les Paramètres"}</Text></View>
  </TouchableOpacity>);
}

function RoleGate({T,back,home,nav,page,orders,bookings,info,onActivate,actionLabel}){
  return (<Page title={`${info.label} - Accès requis`} back={back} home={home} nav={nav} page={page} orders={orders} bookings={bookings} T={T}>
    <View style={[styles.card5DLarge,{backgroundColor:T.card, alignItems:"center", paddingVertical:24}]}>
      <View style={[styles.roleIconWrap5D,{backgroundColor:info.color||"#111",width:64,height:64,borderRadius:32}]}><Text style={{fontSize:32}}>{info.icon}</Text></View>
      <Text style={[styles.cardTitle5D,{color:T.text, marginTop:10, textAlign:"center"}]}>{info.label} non disponible</Text>
      <Text style={[styles.settingsSub,{textAlign:"center",marginTop:6}]}>{info.desc}</Text>
      <TouchableOpacity style={styles.buy5D} onPress={onActivate}><Text style={styles.buy5DT}>{actionLabel}</Text></TouchableOpacity>
    </View>
  </Page>);
}

function Bottom5D({goHome,nav,page,orders,bookings}){
  const items=[
    {id:"home",icon:"🏠",label:"Accueil",active:page==="home",action:goHome,count:0},
    {id:"orders",icon:"📦",label:"Cmd",active:page==="orders",action:()=>nav("orders"),count:orders.length+bookings.length},
    {id:"espaces",icon:"🧰",label:"Espace",active:page==="espaces",action:()=>nav("espaces"),count:0,special:true},
    {id:"wallet",icon:"💳",label:"Wallet",active:page==="wallet",action:()=>nav("wallet"),count:0},
    {id:"client",icon:"👤",label:"Profil",active:page==="client",action:()=>nav("client"),count:0},
  ];
  return (<View style={styles.bottom5DWrapper}><View style={styles.bottom5DIsland}>
    {items.map(item=>(<TouchableOpacity key={item.id} onPress={item.action} style={[styles.bottomItem5D, item.active&&styles.bottomItemActive5D, item.special&&styles.bottomItemSpecial5D]}>
      <View style={[styles.bottomIconWrap5D, item.active&&styles.bottomIconActiveWrap5D, item.special&&styles.bottomIconSpecialWrap5D]}>
        <Text style={[styles.bottomIcon5D, item.active&&styles.bottomIconActive5D, item.special&&styles.bottomIconSpecial5DT]}>{item.icon}</Text>
        {item.count>0&&<View style={styles.badgeCount5D}><Text style={styles.badgeCountT5D}>{item.count}</Text></View>}
      </View>
      <Text style={[styles.bottomLabel5D, item.active&&styles.bottomLabelActive5D]}>{item.label}</Text>
      {item.active&&<View style={styles.activeDot5D}/>}
    </TouchableOpacity>))}
  </View></View>);
}

function Page({title,children,back,home,nav,page,orders,bookings,T}){
  return (<SafeAreaView style={[styles.container,{backgroundColor:T?T.bg:"#F6F7F9"}]}>
    <View style={[styles.pageHead5D,{backgroundColor:T?T.header:"#fff"}]}>
      <TouchableOpacity onPress={back} style={styles.back5D}><Text style={styles.backT5D}>‹</Text></TouchableOpacity>
      <Text style={[styles.pageTitle5D,{color:T?T.text:"#111"}]}>{title}</Text>
      <TouchableOpacity onPress={home} style={styles.home5D}><Text>🏠</Text></TouchableOpacity>
    </View>
    <ScrollView contentContainerStyle={styles.contentBottom5D} showsVerticalScrollIndicator={false}>{children}</ScrollView>
    <Bottom5D goHome={home} nav={nav} page={page} orders={orders} bookings={bookings}/>
  </SafeAreaView>);
}

const styles=StyleSheet.create({
  container:{flex:1}, content:{padding:14,paddingBottom:100}, contentBottom5D:{padding:14,paddingBottom:110},
  header5D:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:12,borderRadius:18,padding:12},
  headerLeft:{flexDirection:"row",alignItems:"center",gap:10}, logo5D:{fontSize:24,fontWeight:"900",letterSpacing:2}, logoSub5D:{fontSize:10,opacity:0.6},
  badge5D:{backgroundColor:"#111",paddingHorizontal:12,paddingVertical:8,borderRadius:14}, badge5DT:{color:"#fff",fontSize:14},
  hero5D:{height:190,borderRadius:24,overflow:"hidden",marginBottom:12}, hero5DOverlay:{flex:1,backgroundColor:"rgba(0,0,0,0.55)",padding:16,justifyContent:"flex-end"},
  hero5DTitle:{color:"#fff",fontSize:18,fontWeight:"900"}, hero5DSub:{color:"#fff",fontSize:10,opacity:0.9,marginTop:4},
  search5D:{flexDirection:"row",backgroundColor:"#fff",borderRadius:14,paddingHorizontal:12,height:46,alignItems:"center",marginTop:10}, searchInput5D:{flex:1,marginLeft:8,fontSize:13},
  guestBtn5D:{backgroundColor:"#fff",borderRadius:16,paddingVertical:14,alignItems:"center",marginTop:6,borderWidth:1.5,borderColor:"#111",borderStyle:"dashed"}, guestBtn5DT:{fontWeight:"800",fontSize:13},
  ruleD5D:{fontSize:11,opacity:0.6,lineHeight:14,marginBottom:8},
  exactResult5D:{borderRadius:20,padding:14,marginBottom:12,borderWidth:2,borderColor:"#111"}, exactTitle:{fontSize:13,fontWeight:"900",color:"#00a651"},
  exactCard5D:{flexDirection:"row",gap:12,marginTop:10,backgroundColor:"#F8F9FA",borderRadius:12,padding:10}, exactImg:{width:60,height:60,borderRadius:10}, exactName:{fontSize:13,fontWeight:"800"}, exactPrice:{fontSize:15,fontWeight:"900",marginTop:4}, exactDetail:{fontSize:10,opacity:0.7,marginTop:4},
  btnPrimary5D:{backgroundColor:"#111",borderRadius:12,paddingVertical:10,paddingHorizontal:14,flex:1,alignItems:"center"}, btnPrimary5DT:{color:"#fff",fontSize:11,fontWeight:"800"},
  btnSecondary5D:{backgroundColor:"#fff",borderRadius:12,paddingVertical:10,paddingHorizontal:14,flex:1,alignItems:"center",borderWidth:1,borderColor:"#E5E8EC"}, btnSecondary5DT:{fontSize:11,fontWeight:"700"},
  cat5D:{paddingHorizontal:12,paddingVertical:7,borderRadius:16,backgroundColor:"#fff",marginRight:6,borderWidth:1,borderColor:"#E5E8EC"}, cat5DActive:{backgroundColor:"#111",borderColor:"#111"}, cat5DT:{fontSize:11}, cat5DActiveT:{color:"#fff",fontSize:11,fontWeight:"700"},
  section5D:{fontSize:15,fontWeight:"900",marginTop:14,marginBottom:8},
  card5D:{borderRadius:20,flexDirection:"row",padding:12,marginBottom:10,alignItems:"center"},
  card5DImg:{width:78,height:78,borderRadius:14}, card5DBody:{flex:1,marginLeft:10}, shopRow5D:{flexDirection:"row",alignItems:"center",gap:6}, shopAvatar5D:{width:18,height:18,borderRadius:9}, shopName5D:{fontSize:10,opacity:0.6},
  productName5D:{fontSize:14,fontWeight:"800",marginTop:2}, priceBlock5D:{backgroundColor:"#F8F9FA",borderRadius:10,padding:8,marginTop:6}, productPrice5D:{fontSize:11,fontWeight:"800"}, comPrice5D:{fontSize:10,opacity:0.7,marginTop:2},
  totalPrice5D:{fontSize:11,fontWeight:"900",marginTop:4,backgroundColor:"#111",color:"#fff",padding:4,borderRadius:6,alignSelf:"flex-start"}, lock5D:{backgroundColor:"#FFF3CD",paddingHorizontal:6,paddingVertical:2,borderRadius:8,alignSelf:"flex-start",marginTop:6}, lock5DT:{fontSize:9,fontWeight:"700"},
  favBtn5D:{padding:6}, roleBadge5D:{borderRadius:12,paddingHorizontal:10,paddingVertical:6}, roleBadge5DT:{fontSize:11,fontWeight:"700"},
  card5DLarge:{borderRadius:22,padding:14,marginBottom:12}, cardTitle5D:{fontSize:14,fontWeight:"900"}, settingsLine:{fontSize:15,fontWeight:"800",marginTop:6}, settingsSub:{fontSize:11,opacity:0.6,marginTop:2},
  separationBlock:{backgroundColor:"#F8F9FA",borderRadius:12,padding:10,marginTop:8},
  sepRow:{flexDirection:"row",justifyContent:"space-between",marginBottom:6}, sepLabel:{fontSize:11,opacity:0.7}, sepValue:{fontSize:11,fontWeight:"800"}, sepValueCom:{fontSize:11,fontWeight:"700",color:"#888"}, sepValueLiv:{fontSize:10,fontWeight:"700",color:"#555"},
  sepTotal:{borderTopWidth:1,borderTopColor:"#E5E8EC",paddingTop:6,marginTop:6}, sepLabelTotal:{fontSize:12,fontWeight:"900"}, sepValueTotal:{fontSize:12,fontWeight:"900",backgroundColor:"#111",color:"#fff",paddingHorizontal:8,paddingVertical:3,borderRadius:8},
  grid5D:{flexDirection:"row",flexWrap:"wrap",gap:10,marginTop:8}, gridItem5D:{width:"48%",height:110,borderRadius:18,overflow:"hidden"}, gridImg5D:{flex:1,justifyContent:"flex-end"}, gridOverlay5D:{backgroundColor:"rgba(0,0,0,0.55)",padding:10}, gridTitle5D:{color:"#fff",fontSize:12,fontWeight:"900"}, gridSub5D:{color:"#fff",fontSize:10,opacity:0.9},
  serviceBanner5D:{height:100,borderRadius:20,overflow:"hidden",marginBottom:12},
  ratingLine5D:{fontSize:12,fontWeight:"800",marginBottom:8},
  detailHero5D:{height:320,borderRadius:24,overflow:"hidden",marginBottom:12}, detailOverlay5D:{flex:1,backgroundColor:"rgba(0,0,0,0.4)",padding:16,justifyContent:"flex-end"}, detailName5D:{color:"#fff",fontSize:22,fontWeight:"900"},
  detailPriceReal5D:{color:"#fff",fontSize:20,fontWeight:"900",marginTop:6,backgroundColor:"rgba(0,0,0,0.5)",paddingHorizontal:10,paddingVertical:4,borderRadius:8,alignSelf:"flex-start"},
  buy5D:{backgroundColor:"#111",borderRadius:16,paddingVertical:14,alignItems:"center",marginTop:10}, buy5DT:{color:"#fff",fontWeight:"900",fontSize:13},
  secondary5D:{backgroundColor:"#fff",borderRadius:16,paddingVertical:14,alignItems:"center",marginTop:8,borderWidth:1,borderColor:"#E5E8EC"}, secondary5DT:{fontWeight:"700"},
  dangerBtn5D:{backgroundColor:"#FFF0F0",borderRadius:16,paddingVertical:14,alignItems:"center",marginTop:8,borderWidth:1,borderColor:"#FFCACA"}, dangerBtn5DT:{fontWeight:"800",color:"#D00"},
  security5D:{backgroundColor:"#E9F0FF",borderRadius:16,padding:12,marginBottom:12,borderWidth:1,borderColor:"#B8D0FF"}, securityTitle5D:{fontSize:12,fontWeight:"900"}, securityText5D:{fontSize:11,marginTop:4,lineHeight:14},
  checkoutImg5D:{width:60,height:60,borderRadius:12}, checkoutTotal5D:{fontSize:12,fontWeight:"900",marginTop:4,backgroundColor:"#111",color:"#fff",padding:4,borderRadius:6,alignSelf:"flex-start"},
  walletHero5D:{height:150,borderRadius:24,overflow:"hidden",marginBottom:12}, walletOverlay5D:{flex:1,backgroundColor:"rgba(0,0,0,0.6)",padding:16,justifyContent:"center"}, walletLabel5D:{color:"#fff",opacity:0.7,fontSize:11}, walletBalance5D:{color:"#fff",fontSize:26,fontWeight:"900",marginTop:4}, walletSub5D:{color:"#fff",fontSize:10,opacity:0.9,marginTop:4},
  input5D:{borderWidth:1,borderColor:"#E5E8EC",borderRadius:12,padding:12,marginTop:8,fontSize:13,backgroundColor:"#fff"},
  history5D:{borderRadius:14,padding:12,flexDirection:"row",alignItems:"center",gap:10,marginBottom:8}, historyIcon5D:{width:36,height:36,borderRadius:18,alignItems:"center",justifyContent:"center"}, historyTitle5D:{fontSize:12,fontWeight:"700"}, historyAmount5D:{fontSize:12,fontWeight:"900",marginLeft:"auto"},
  spaceHero5D:{height:120,borderRadius:22,overflow:"hidden",marginBottom:12}, spaceOverlay5D:{flex:1,backgroundColor:"rgba(0,0,0,0.55)",padding:14,justifyContent:"center"}, spaceTitle5D:{color:"#fff",fontSize:18,fontWeight:"900"}, spaceSub5D:{color:"#fff",fontSize:11,opacity:0.9,marginTop:4},
  add5D:{borderRadius:16,flexDirection:"row",alignItems:"center",padding:12,gap:12,marginBottom:12}, addImg5D:{width:48,height:48,borderRadius:12}, addT5D:{fontSize:13,fontWeight:"900"},
  myProd5D:{borderRadius:14,padding:10,flexDirection:"row",gap:10,marginBottom:8,alignItems:"center"}, myProdImg5D:{width:60,height:60,borderRadius:10}, myProdName5D:{fontSize:12,fontWeight:"800"}, myProdPrice5D:{fontSize:11,opacity:0.7,marginTop:2},
  editBtn5D:{backgroundColor:"#F1F3F5",borderRadius:10,paddingHorizontal:10,paddingVertical:8}, editBtn5DT:{fontSize:11,fontWeight:"800"},
  timeline5D:{borderRadius:18,padding:14,marginBottom:12}, timeRow5D:{flexDirection:"row",gap:12,marginBottom:16,alignItems:"center"}, timeCircle5D:{width:28,height:28,borderRadius:14,backgroundColor:"#E9ECEF",alignItems:"center",justifyContent:"center"}, timeActive5D:{backgroundColor:"#111"}, timeTitle5D:{fontSize:12,opacity:0.5,fontWeight:"700"}, timeActiveTitle5D:{opacity:1,color:"#111"},
  delivery5D:{borderRadius:16,padding:12,marginBottom:10}, deliveryTitle5D:{fontSize:12,fontWeight:"800"},
  permutaCard5D:{borderRadius:18,padding:14,marginBottom:10}, permutaRow5D:{flexDirection:"row",alignItems:"center",justifyContent:"center",gap:12}, permutaImg5D:{width:80,height:80,borderRadius:14}, permutaName5D:{fontSize:13,fontWeight:"800",marginTop:10,textAlign:"center"},
  orderImg5D:{width:50,height:50,borderRadius:10}, fidelity5D:{fontSize:11,opacity:0.7,marginTop:4},
  pageHead5D:{height:56,paddingHorizontal:12,flexDirection:"row",alignItems:"center",justifyContent:"space-between"}, pageTitle5D:{fontSize:14,fontWeight:"900"}, back5D:{width:36,height:36,alignItems:"center",justifyContent:"center",backgroundColor:"#F1F3F5",borderRadius:18}, backT5D:{fontSize:20}, home5D:{width:36,height:36,alignItems:"center",justifyContent:"center",backgroundColor:"#F1F3F5",borderRadius:18},
  bottom5DWrapper:{position:"absolute",bottom:0,left:0,right:0,alignItems:"center",paddingBottom:8,paddingHorizontal:10}, bottom5DIsland:{flexDirection:"row",backgroundColor:"#111",borderRadius:24,paddingVertical:8,paddingHorizontal:12,gap:4},
  bottomItem5D:{alignItems:"center",justifyContent:"center",paddingHorizontal:12,paddingVertical:6,borderRadius:16,minWidth:60}, bottomItemActive5D:{backgroundColor:"rgba(255,255,255,0.15)"}, bottomItemSpecial5D:{backgroundColor:"#FFD700",borderRadius:20,transform:[{scale:1.1}]},
  bottomIconWrap5D:{width:36,height:36,borderRadius:18,backgroundColor:"rgba(255,255,255,0.08)",alignItems:"center",justifyContent:"center"}, bottomIconActiveWrap5D:{backgroundColor:"rgba(255,255,255,0.2)"}, bottomIconSpecialWrap5D:{backgroundColor:"#111",width:40,height:40,borderRadius:20},
  bottomIcon5D:{fontSize:18,color:"#fff"}, bottomIconActive5D:{fontSize:20}, bottomIconSpecial5DT:{fontSize:22,color:"#FFD700"},
  badgeCount5D:{position:"absolute",top:-4,right:-6,backgroundColor:"#FF3B30",borderRadius:10,minWidth:18,height:18,alignItems:"center",justifyContent:"center",paddingHorizontal:4,borderWidth:2,borderColor:"#111"}, badgeCountT5D:{color:"#fff",fontSize:9,fontWeight:"900"},
  bottomLabel5D:{fontSize:9,color:"rgba(255,255,255,0.6)",marginTop:4,fontWeight:"600"}, bottomLabelActive5D:{color:"#fff",fontWeight:"800"}, activeDot5D:{width:4,height:4,borderRadius:2,backgroundColor:"#FFD700",marginTop:2},
  modalBg5D:{flex:1,backgroundColor:"rgba(0,0,0,0.6)",justifyContent:"flex-end"}, modal5D:{backgroundColor:"#fff",borderTopLeftRadius:24,borderTopRightRadius:24,padding:18,paddingBottom:28}, modalTitle5D:{fontSize:16,fontWeight:"900",marginBottom:12},
  empty5D:{backgroundColor:"#fff",borderRadius:18,padding:20,alignItems:"center",marginTop:10},
  roleCard5D:{flexDirection:"row",alignItems:"center",backgroundColor:"#fff",borderRadius:16,padding:12,marginBottom:8,borderWidth:2,borderColor:"#E5E8EC"},
  roleIconWrap5D:{width:40,height:40,borderRadius:20,alignItems:"center",justifyContent:"center"},
  roleCard5DTitle:{fontSize:13,fontWeight:"800"}, roleCard5DDesc:{fontSize:11,opacity:0.6,marginTop:2},
  espaceCard5D:{flexDirection:"row",alignItems:"center",borderRadius:18,padding:14,marginBottom:10},
  switchRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingVertical:8},
  slotBtn5D:{backgroundColor:"#fff",borderRadius:14,padding:14,marginBottom:8,borderWidth:1,borderColor:"#E5E8EC"}, slotBtnActive5D:{backgroundColor:"#111",borderColor:"#111"}, slotBtnT5D:{fontWeight:"700",fontSize:13},
  msgBubble5D:{borderRadius:14,padding:10,marginBottom:8,maxWidth:"80%"}, msgClient5D:{backgroundColor:"#111",alignSelf:"flex-end"}, msgVendor5D:{backgroundColor:"#F1F3F5",alignSelf:"flex-start"}, msgText5D:{color:"#fff",fontSize:12},
  sendBtn5D:{backgroundColor:"#111",borderRadius:12,width:46,height:46,alignItems:"center",justifyContent:"center",marginTop:8},
});
