"use client";

import {
  Utensils, Car, Home, Heart, ShoppingBag, Plane, Gamepad2, GraduationCap,
  Stethoscope, Dumbbell, Wifi, Zap, Droplet, Building2, Gift, Shirt,
  Coffee, Bus, Film, Briefcase, PiggyBank, DollarSign, CreditCard,
  Wallet, TrendingUp, Receipt, Baby, Dog, Wrench, Fuel, ShieldCheck,
  BookOpen, Music, Phone, Tv, Pizza, Beer, Church, HandCoins, Tag,
  ShoppingCart, Smartphone,
  type LucideIcon,
} from "lucide-react";

// Mapa nome → componente lucide. cat_meta.icone guarda o nome (string).
export const ICON_MAP: Record<string, LucideIcon> = {
  Utensils, Car, Home, Heart, ShoppingBag, Plane, Gamepad2, GraduationCap,
  Stethoscope, Dumbbell, Wifi, Zap, Droplet, Building2, Gift, Shirt,
  Coffee, Bus, Film, Briefcase, PiggyBank, DollarSign, CreditCard,
  Wallet, TrendingUp, Receipt, Baby, Dog, Wrench, Fuel, ShieldCheck,
  BookOpen, Music, Phone, Tv, Pizza, Beer, Church, HandCoins, Tag,
  ShoppingCart, Smartphone,
};

// Dicionário de tradução: converte as chaves do AjustesClient para o ICON_MAP da Lucide
const TRADUCAO_ICONES: Record<string, string> = {
  tag: "Tag",
  casa: "Home",
  carro: "Car",
  comida: "Utensils",
  mercado: "ShoppingCart",
  saude: "Heart",
  viagem: "Plane",
  presente: "Gift",
  fone: "Smartphone",
  academia: "Dumbbell",
  escola: "GraduationCap",
  cofre: "PiggyBank",
  trabalho: "Briefcase",
  energia: "Zap",
  cafe: "Coffee",
  dinheiro: "DollarSign",
  bebe: "Baby",
  ferramenta: "Wrench",
  // Novos ícones
  wifi: "Wifi",
  agua: "Droplet",
  filme: "Film",
  musica: "Music",
  livro: "BookOpen",
  combustivel: "Fuel",
  seguro: "ShieldCheck",
  onibus: "Bus",
  predio: "Building2",
  pet: "Dog",
  investimento: "TrendingUp",
  roupa: "Shirt",
  pizza: "Pizza",
  bebida: "Beer",
  nota: "Receipt",
  carteira: "Wallet",
  telefone: "Phone",
  tv: "Tv",
};

export const ICON_NAMES = Object.keys(ICON_MAP);

export interface CatMeta { chave: string; cor: string; icone: string }

// Retorna o componente do ícone para uma categoria com tratamento de falhas e tipos
export function iconeDaCategoria(cat: string, catMeta: CatMeta[], tipo?: "despesa" | "receita"): LucideIcon {
  const chaveComTipo = tipo ? `${tipo}:${cat}` : "";
  
  // 1. Tenta buscar pela chave exata com tipo (ex: "despesa:Alimentação") ou nome direto
  let meta = catMeta.find(m => (tipo && m.chave === chaveComTipo) || m.chave === cat);
  
  // 2. Fallback por aproximação se a tela passou apenas o nome da categoria
  if (!meta) {
    meta = catMeta.find(m => m.chave.endsWith(`:${cat}`));
  }

  if (meta) {
    // Normaliza para buscar no mapa traduzido ou direto
    const nomeNormalizado = meta.icone.toLowerCase();
    const nomeLucide = TRADUCAO_ICONES[nomeNormalizado] || meta.icone;
    
    if (ICON_MAP[nomeLucide]) return ICON_MAP[nomeLucide];
    if (ICON_MAP[meta.icone]) return ICON_MAP[meta.icone]; // Fallback para nomes vindo de migrações SQL
  }
  return Tag;
}

const PALETA_FALLBACK = ["#2a8a72","#c9952d","#c0492f","#1d5c4f","#3b6ea5","#8a5cb8","#d17b3f","#b8456b","#5a7d3a","#6f7d77"];

// Retorna a cor da categoria com o mesmo tratamento de fallback por tipo
export function corDaCategoria(cat: string, catMeta: CatMeta[], tipo?: "despesa" | "receita"): string {
  const chaveComTipo = tipo ? `${tipo}:${cat}` : "";
  
  let meta = catMeta.find(m => (tipo && m.chave === chaveComTipo) || m.chave === cat);
  
  if (!meta) {
    meta = catMeta.find(m => m.chave.endsWith(`:${cat}`));
  }

  if (meta?.cor) return meta.cor;
  
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = cat.charCodeAt(i) + ((h << 5) - h);
  return PALETA_FALLBACK[Math.abs(h) % PALETA_FALLBACK.length];
}
