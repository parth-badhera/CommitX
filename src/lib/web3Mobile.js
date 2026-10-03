"use client";

/**
 * Mobile Web3 & MetaMask utilities.
 * Handles device detection, deep links, and app store redirects.
 */

export function isMobileDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || navigator.vendor || window.opera || "";
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const isTouch = Boolean(navigator.maxTouchPoints && navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua)); // iPadOS Safari
  return mobileRegex.test(ua) || isTouch;
}

export function isMetaMaskBrowser() {
  if (typeof window === "undefined") return false;
  return Boolean(window.ethereum?.isMetaMask);
}

export function getMetaMaskDeepLink(customUrl, autoConnect = true) {
  if (typeof window === "undefined") return "https://metamask.app.link/dapp/commit-x.vercel.app";
  
  const urlObj = new URL(customUrl || (typeof window !== "undefined" ? window.location.href : "https://commit-x.vercel.app"));
  const params = new URLSearchParams(urlObj.search);
  if (autoConnect) {
    params.set("connect", "true");
  }
  const queryString = params.toString();
  const cleanBase = `${urlObj.host}${urlObj.pathname}`.replace(/\/$/, "");
  const targetWithQuery = `${cleanBase}${queryString ? `?${queryString}` : ""}`;

  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  const isAndroid = /Android/i.test(ua);

  // On Android Chrome, navigating to https://metamask.app.link often opens inside Chrome as a web page.
  // Using an explicit Android Intent forces the OS to launch the MetaMask app directly.
  if (isAndroid) {
    return `intent://${targetWithQuery}#Intent;scheme=dapp;package=io.metamask;end`;
  }

  return `https://metamask.app.link/dapp/${targetWithQuery}`;
}

export function getMetaMaskUniversalLink(customUrl, autoConnect = true) {
  if (typeof window === "undefined") return "https://metamask.app.link/dapp/commit-x.vercel.app";
  const urlObj = new URL(customUrl || (typeof window !== "undefined" ? window.location.href : "https://commit-x.vercel.app"));
  const params = new URLSearchParams(urlObj.search);
  if (autoConnect) params.set("connect", "true");
  const queryString = params.toString();
  const cleanBase = `${urlObj.host}${urlObj.pathname}`.replace(/\/$/, "");
  return `https://metamask.app.link/dapp/${cleanBase}${queryString ? `?${queryString}` : ""}`;
}

/**
 * Direct App Store / Google Play link for downloading MetaMask
 */
export function getStoreLink() {
  if (typeof navigator === "undefined") return "https://metamask.io/download/";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return "https://apps.apple.com/app/metamask/id1438144201";
  }
  if (/Android/i.test(ua)) {
    return "https://play.google.com/store/apps/details?id=io.metamask";
  }
  return "https://metamask.io/download/";
}
