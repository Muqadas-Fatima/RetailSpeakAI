"use client";
import { createContext, useContext, useEffect, useMemo, useState, type Context, type ReactNode } from "react";

export type Language = "en" | "ur";

const STORAGE_KEY = "retailai.language";

const translations: Record<Language, Record<string, string>> = {
  en: {
    "common.back": "Back",
    "common.signIn": "Sign In",
    "common.signUp": "Sign Up",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.continue": "Continue",
    "common.close": "Close",

    "welcome.title": "Welcome",
    "welcome.line1": "Experience the future of ordering",
    "welcome.line2": "with AI voice assistance.",
    "welcome.line3": "Fast, smart and effortless.",

    "signin.title": "Sign In",
    "signin.subtitle1": "Welcome back! Please sign in to",
    "signin.subtitle2": "continue to your account.",
    "signin.username": "Username",
    "signin.password": "Password",
    "signin.forgot": "Forgot Password?",
    "signin.divider": "or continue with",
    "signin.google": "Continue with Google",
    "signin.facebook": "Continue with Facebook",
    "signin.noAccount": "Don't have an account?",
    "signin.signupLink": "signup",
    "signin.toast.signedIn": "Signed in (demo only)",
    "signin.toast.forgot": "Password reset is not available in this demo",
    "signin.toast.google": "Google sign-in is mocked in this demo",
    "signin.toast.facebook": "Facebook sign-in is mocked in this demo",

    "signup.title": "Create Account",
    "signup.subtitle": "Sign up to get started with Retail AI.",
    "signup.fullName": "Full Name",
    "signup.email": "Email",
    "signup.phone": "Phone Number",
    "signup.gender": "Select Gender",
    "signup.gender.male": "Male",
    "signup.gender.female": "Female",
    "signup.gender.other": "Other",
    "signup.gender.preferNotToSay": "Prefer not to say",
    "signup.age": "Age",
    "signup.language": "Select Language",
    "signup.lang.english": "English",
    "signup.lang.urdu": "Urdu",
    "signup.password": "Password",
    "signup.confirmPassword": "Confirm Password",
    "signup.creating": "Creating account…",
    "signup.haveAccount": "Already have an account?",
    "signup.duplicate": "An account with this email already exists. Please sign in.",
    "signup.success.title": "Account created successfully",
    "signup.success.body": "Next, set your delivery location so we can show what is available near you.",
    "signup.success.cta": "Continue",

    "val.fullName": "Please enter your full name.",
    "val.emailRequired": "Email is required.",
    "val.emailInvalid": "Please enter a valid email address.",
    "val.phoneRequired": "Phone number is required.",
    "val.phoneInvalid": "Please enter a valid phone number.",
    "val.gender": "Please select your gender.",
    "val.ageRequired": "Please enter your age.",
    "val.ageNumber": "Age must be a number.",
    "val.ageRange": "Age must be between 13 and 120.",
    "val.language": "Please select your preferred language.",
    "val.passwordRequired": "Password is required.",
    "val.passwordMin": "Use at least 6 characters.",
    "val.confirmRequired": "Please confirm your password.",
    "val.passwordMismatch": "Passwords do not match.",
    "val.currentPasswordRequired": "Please enter your current password.",
    "val.newPasswordRequired": "Please enter a new password.",
    "val.newPasswordMin": "New password must be at least 6 characters.",
    "val.currentPasswordIncorrect": "Current password is incorrect.",

    "settings.title": "Settings",
    "settings.subtitle": "Manage your account preferences.",
    "settings.accountTitle": "Account Info",
    "settings.accountDesc": "Your registered account details.",
    "settings.editProfile": "Edit Profile",
    "settings.saveProfile": "Save Changes",
    "settings.cancel": "Cancel",
    "settings.profileSaved": "Profile updated successfully",
    "settings.profileInvalid": "Please enter a valid name, phone and age",
    "settings.fullName": "Full Name",
    "settings.email": "Email",
    "settings.phone": "Phone Number",
    "settings.gender": "Gender",
    "settings.age": "Age",
    "settings.language": "Language",
    "settings.noAccount": "No account is currently signed in.",
    "settings.signIn": "Sign in",

    "settings.passwordTitle": "Change Password",
    "settings.passwordDesc": "Update your account password.",
    "settings.currentPassword": "Current Password",
    "settings.newPassword": "New Password",
    "settings.confirmNewPassword": "Confirm New Password",
    "settings.changePassword": "Change Password",
    "settings.passwordChanged": "Password changed successfully",

    "settings.notificationsTitle": "Notifications",
    "settings.notificationsDesc": "Choose what alerts you want to receive.",
    "settings.orderUpdates": "Order Updates",
    "settings.promotions": "Promotions & Offers",
    "settings.newFeatures": "New Features",
    "settings.notificationsSaved": "Notification preferences saved",


    "settings.languageTitle": "Language",
    "settings.languageDesc":
      "Choose your preferred app language. Changes apply instantly across the app.",
    "settings.saved": "Language preference saved",

    "nav.home": "Home",
    "nav.orders": "Orders",
    "nav.track": "Track",
    "nav.profile": "Profile",
    "nav.voice": "Voice ordering",

    "profile.title": "Profile & Settings",
    "profile.editProfile": "Edit Profile",
    "profile.logout": "Logout",
    "profile.loggedOut": "You have been signed out.",
    "profile.comingSoon": "is coming soon in this prototype.",
    "profile.languageChanged": "Language changed to",
    "profile.section.account": "Account",
    "profile.section.preferences": "Preferences",
    "profile.section.support": "Support",
    "profile.section.other": "Other",
    "profile.row.personal": "Edit Profile",
    "profile.row.password": "Change Password",
    "profile.row.email-change": "Change Email",
    "profile.row.addresses": "Saved Addresses",
    "profile.row.language": "Language",
    "profile.row.theme": "Theme",
    "profile.row.notifications": "Notifications",
    "profile.row.help": "Help & Support",
    "profile.row.privacy-policy": "Privacy Policy",
    "profile.row.terms": "Terms & Conditions",
    "profile.row.about": "About RetailAI",
    "profile.row.rate": "Rate App",
    "profile.row.logout": "Logout",
    "profile.version": "Version 1.0.0",
    "profile.edit.title": "Personal Information",
    "profile.edit.fullName": "Full Name",
    "profile.edit.fullNamePh": "Your full name",
    "profile.edit.email": "Email",
    "profile.edit.emailPh": "you@example.com",
    "profile.edit.phone": "Phone Number",
    "profile.edit.phonePh": "+92 300 1234567",
    "profile.edit.address": "Delivery Address",
    "profile.edit.addressPh": "House, street, area, city",
    "profile.edit.save": "Save Changes",
    "profile.edit.required": "Name and email are required",
    "profile.edit.updated": "Profile updated",
    "profile.edit.currentPw": "Current Password",
    "profile.edit.currentPwPh": "Enter current password",
    "profile.edit.newPw": "New Password",
    "profile.edit.newPwPh": "At least 8 characters",
    "profile.edit.confirmPw": "Confirm New Password",
    "profile.edit.confirmPwPh": "Re-enter new password",
    "profile.edit.savePw": "Update Password",
    "profile.edit.pwRequired": "Fill in all password fields",
    "profile.edit.pwShort": "New password must be at least 8 characters",
    "profile.edit.pwMismatch": "Passwords do not match",
    "profile.edit.pwUpdated": "Password updated",
    "profile.edit.newEmail": "New Email Address",
    "profile.edit.newEmailPh": "new@example.com",
    "profile.edit.saveEmail": "Update Email",
    "profile.edit.emailInvalid": "Enter a valid email address",
    "profile.edit.emailUpdated": "Email updated",

    "profile.addr.title": "Saved Addresses",
    "profile.addr.empty": "No saved addresses yet. Add one below.",
    "profile.addr.addNew": "Add New Address",
    "profile.addr.addTitle": "Add new address",
    "profile.addr.type": "Address type",
    "profile.addr.field": "Address",
    "profile.addr.placeholder": "House #, street, area, city",
    "profile.addr.save": "Save Address",
    "profile.addr.cancel": "Cancel",
    "profile.addr.required": "Address is required",
    "profile.addr.saved": "address saved",
    "profile.addr.removed": "address removed",
    "profile.addr.label.Home": "Home",
    "profile.addr.label.Office": "Office",
    "profile.addr.label.Other": "Other",

    "location.headingA": "Allow",
    "location.headingB": "location access",
    "location.headingC": "on the next screen for:",
    "location.benefit1.title": "Available products near you",
    "location.benefit1.desc":
      "We need your location to check available products for delivery to that area.",
    "location.benefit2.title": "Accurate delivery",
    "location.benefit2.desc":
      "Get the right delivery options, estimated time and real-time order updates for your location.",
    "location.continue": "Continue",
    "location.requesting": "Requesting location…",
    "location.granted": "Location access granted",
    "location.denied": "Location permission denied — you can enable it later",
    "location.unavailable": "Location is not available on this device",

    "address.title": "What's your address?",
    "address.placeholder": "Enter your address",
    "address.confirm": "Confirm",
    "address.saved": "Address saved (demo only)",
    "address.locate": "Use current location",
    "address.locateMock": "Current location is mocked in this demo",
    "address.satelliteAlt": "Satellite map preview",

    "agent.menu": "Open menu",
    "agent.orbLabel": "Tap here",
    "agent.greetingUrdu": "میں کیا لاؤں آپ کے لیے؟",
    "agent.greetingRoman": "Main kya laoon aap ke liye?",
    "agent.tapToSpeak": "Tap to speak or type your order",
    "agent.categories": "Categories",
    "agent.seeAll": "See All",
    "agent.popular": "Popular Items",
    "agent.cart": "Open cart",
    "agent.cartCount": "3",
    "agent.typePlaceholder": "Type what you want to order…",
    "agent.send": "Send order message",
    "agent.mockMessage": "Order message received (demo)",
    "agent.mockVoice": "Voice ordering is mocked in this demo",
    "agent.mockAction": "This action is mocked in this demo",
    "agent.cat.groceries": "Groceries",
    "agent.cat.beverages": "Beverages",
    "agent.cat.dairy": "Dairy",
    "agent.cat.snacks": "Snacks",
    "agent.item.milk": "Fresh Milk 1L",
    "agent.item.cola": "Coca Cola 1.5L",
    "agent.item.bread": "Bread Slice",
    "agent.item.eggs": "Eggs (30 Pack)",
  },
  ur: {
    "common.back": "واپس",
    "common.signIn": "سائن ان",
    "common.signUp": "سائن اپ",
    "common.save": "محفوظ کریں",
    "common.cancel": "منسوخ کریں",
    "common.continue": "جاری رکھیں",
    "common.close": "بند کریں",

    "welcome.title": "خوش آمدید",
    "welcome.line1": "AI وائس اسسٹینس کے ساتھ آرڈرنگ",
    "welcome.line2": "کے مستقبل کا تجربہ کریں۔",
    "welcome.line3": "تیز، سمارٹ اور آسان۔",

    "signin.title": "سائن ان",
    "signin.subtitle1": "خوش آمدید! براہ کرم سائن ان کریں",
    "signin.subtitle2": "اپنے اکاؤنٹ میں جاری رکھنے کے لیے۔",
    "signin.username": "صارف نام",
    "signin.password": "پاس ورڈ",
    "signin.forgot": "پاس ورڈ بھول گئے؟",
    "signin.divider": "یا اس کے ساتھ جاری رکھیں",
    "signin.google": "Google کے ساتھ جاری رکھیں",
    "signin.facebook": "Facebook کے ساتھ جاری رکھیں",
    "signin.noAccount": "اکاؤنٹ نہیں ہے؟",
    "signin.signupLink": "سائن اپ",
    "signin.toast.signedIn": "سائن ان ہو گیا (صرف ڈیمو)",
    "signin.toast.forgot": "اس ڈیمو میں پاس ورڈ ری سیٹ دستیاب نہیں ہے",
    "signin.toast.google": "اس ڈیمو میں Google سائن ان فرضی ہے",
    "signin.toast.facebook": "اس ڈیمو میں Facebook سائن ان فرضی ہے",

    "signup.title": "اکاؤنٹ بنائیں",
    "signup.subtitle": "Retail AI کے ساتھ شروعات کے لیے سائن اپ کریں۔",
    "signup.fullName": "پورا نام",
    "signup.email": "ای میل",
    "signup.phone": "فون نمبر",
    "signup.gender": "صنف منتخب کریں",
    "signup.gender.male": "مرد",
    "signup.gender.female": "عورت",
    "signup.gender.other": "دیگر",
    "signup.gender.preferNotToSay": "بتانا پسند نہیں کریں گے",
    "signup.age": "عمر",
    "signup.language": "زبان منتخب کریں",
    "signup.lang.english": "انگریزی",
    "signup.lang.urdu": "اردو",
    "signup.password": "پاس ورڈ",
    "signup.confirmPassword": "پاس ورڈ کی تصدیق کریں",
    "signup.creating": "اکاؤنٹ بنایا جا رہا ہے…",
    "signup.haveAccount": "پہلے سے اکاؤنٹ ہے؟",
    "signup.duplicate": "اس ای میل کے ساتھ اکاؤنٹ پہلے سے موجود ہے۔ براہ کرم سائن ان کریں۔",
    "signup.success.title": "اکاؤنٹ کامیابی سے بن گیا",
    "signup.success.body": "اب اپنی ڈیلیوری لوکیشن منتخب کریں تاکہ ہم قریبی دستیاب اشیاء دکھا سکیں۔",
    "signup.success.cta": "جاری رکھیں",

    "val.fullName": "براہ کرم اپنا پورا نام درج کریں۔",
    "val.emailRequired": "ای میل درکار ہے۔",
    "val.emailInvalid": "براہ کرم درست ای میل درج کریں۔",
    "val.phoneRequired": "فون نمبر درکار ہے۔",
    "val.phoneInvalid": "براہ کرم درست فون نمبر درج کریں۔",
    "val.gender": "براہ کرم اپنی صنف منتخب کریں۔",
    "val.ageRequired": "براہ کرم اپنی عمر درج کریں۔",
    "val.ageNumber": "عمر عدد میں ہونی چاہیے۔",
    "val.ageRange": "عمر 13 سے 120 کے درمیان ہونی چاہیے۔",
    "val.language": "براہ کرم اپنی پسندیدہ زبان منتخب کریں۔",
    "val.passwordRequired": "پاس ورڈ درکار ہے۔",
    "val.passwordMin": "کم از کم 6 حروف استعمال کریں۔",
    "val.confirmRequired": "براہ کرم اپنے پاس ورڈ کی تصدیق کریں۔",
    "val.passwordMismatch": "پاس ورڈ مماثل نہیں ہیں۔",
    "val.currentPasswordRequired": "براہ کرم اپنا موجودہ پاس ورڈ درج کریں۔",
    "val.newPasswordRequired": "براہ کرم نیا پاس ورڈ درج کریں۔",
    "val.newPasswordMin": "نیا پاس ورڈ کم از کم 6 حروف کا ہونا چاہیے۔",
    "val.currentPasswordIncorrect": "موجودہ پاس ورڈ غلط ہے۔",

    "settings.title": "ترتیبات",
    "settings.subtitle": "اپنے اکاؤنٹ کی ترجیحات منظم کریں۔",
    "settings.accountTitle": "اکاؤنٹ کی معلومات",
    "settings.accountDesc": "آپ کے رجسٹرڈ اکاؤنٹ کی تفصیلات۔",
    "settings.editProfile": "پروفائل میں تبدیلی",
    "settings.saveProfile": "تبدیلیاں محفوظ کریں",
    "settings.cancel": "منسوخ کریں",
    "settings.profileSaved": "پروفائل کامیابی سے اپ ڈیٹ ہو گیا",
    "settings.profileInvalid": "براہ کرم درست نام، فون اور عمر درج کریں",
    "settings.fullName": "پورا نام",
    "settings.email": "ای میل",
    "settings.phone": "فون نمبر",
    "settings.gender": "صنف",
    "settings.age": "عمر",
    "settings.language": "زبان",
    "settings.noAccount": "فی الحال کوئی اکاؤنٹ سائن ان نہیں ہے۔",
    "settings.signIn": "سائن ان کریں",

    "settings.passwordTitle": "پاس ورڈ تبدیل کریں",
    "settings.passwordDesc": "اپنے اکاؤنٹ کا پاس ورڈ اپڈیٹ کریں۔",
    "settings.currentPassword": "موجودہ پاس ورڈ",
    "settings.newPassword": "نیا پاس ورڈ",
    "settings.confirmNewPassword": "نیا پاس ورڈ تصدیق کریں",
    "settings.changePassword": "پاس ورڈ تبدیل کریں",
    "settings.passwordChanged": "پاس ورڈ کامیابی سے تبدیل ہو گیا",

    "settings.notificationsTitle": "نوٹیفکیشنز",
    "settings.notificationsDesc": "منتخب کریں کہ آپ کن الرٹس کو وصول کرنا چاہتے ہیں۔",
    "settings.orderUpdates": "آرڈر اپڈیٹس",
    "settings.promotions": "پروموشنز اور آفرز",
    "settings.newFeatures": "نئی خصوصیات",
    "settings.notificationsSaved": "نوٹیفکیشن کی ترجیحات محفوظ کر لی گئیں",


    "settings.languageTitle": "زبان",
    "settings.languageDesc":
      "اپنی پسندیدہ ایپ کی زبان منتخب کریں۔ تبدیلیاں پوری ایپ میں فوری طور پر لاگو ہوں گی۔",
    "settings.saved": "زبان کی ترجیح محفوظ کر لی گئی",

    "nav.home": "ہوم",
    "nav.orders": "آرڈرز",
    "nav.track": "ٹریک",
    "nav.profile": "پروفائل",
    "nav.voice": "وائس آرڈرنگ",

    "profile.title": "پروفائل اور ترتیبات",
    "profile.editProfile": "پروفائل تبدیل کریں",
    "profile.logout": "لاگ آؤٹ",
    "profile.loggedOut": "آپ سائن آؤٹ ہو گئے ہیں۔",
    "profile.comingSoon": "اس پروٹوٹائپ میں جلد آ رہا ہے۔",
    "profile.languageChanged": "زبان تبدیل ہو گئی:",
    "profile.section.account": "اکاؤنٹ",
    "profile.section.preferences": "ترجیحات",
    "profile.section.support": "مدد",
    "profile.section.other": "دیگر",
    "profile.row.personal": "پروفائل تبدیل کریں",
    "profile.row.password": "پاس ورڈ تبدیل کریں",
    "profile.row.email-change": "ای میل تبدیل کریں",
    "profile.row.addresses": "محفوظ شدہ پتے",
    "profile.row.language": "زبان",
    "profile.row.theme": "تھیم",
    "profile.row.notifications": "نوٹیفکیشنز",
    "profile.row.help": "مدد اور سپورٹ",
    "profile.row.privacy-policy": "پرائیویسی پالیسی",
    "profile.row.terms": "شرائط و ضوابط",
    "profile.row.about": "RetailAI کے بارے میں",
    "profile.row.rate": "ایپ ریٹ کریں",
    "profile.row.logout": "لاگ آؤٹ",
    "profile.version": "ورژن 1.0.0",
    "profile.edit.title": "ذاتی معلومات",
    "profile.edit.fullName": "پورا نام",
    "profile.edit.fullNamePh": "آپ کا پورا نام",
    "profile.edit.email": "ای میل",
    "profile.edit.emailPh": "you@example.com",
    "profile.edit.phone": "فون نمبر",
    "profile.edit.phonePh": "+92 300 1234567",
    "profile.edit.address": "ڈیلیوری کا پتہ",
    "profile.edit.addressPh": "گھر، گلی، علاقہ، شہر",
    "profile.edit.save": "تبدیلیاں محفوظ کریں",
    "profile.edit.required": "نام اور ای میل درکار ہیں",
    "profile.edit.updated": "پروفائل اپ ڈیٹ ہو گیا",
    "profile.edit.currentPw": "موجودہ پاس ورڈ",
    "profile.edit.currentPwPh": "موجودہ پاس ورڈ درج کریں",
    "profile.edit.newPw": "نیا پاس ورڈ",
    "profile.edit.newPwPh": "کم از کم 8 حروف",
    "profile.edit.confirmPw": "نئے پاس ورڈ کی تصدیق",
    "profile.edit.confirmPwPh": "نیا پاس ورڈ دوبارہ درج کریں",
    "profile.edit.savePw": "پاس ورڈ اپ ڈیٹ کریں",
    "profile.edit.pwRequired": "تمام پاس ورڈ خانے پُر کریں",
    "profile.edit.pwShort": "نیا پاس ورڈ کم از کم 8 حروف کا ہونا چاہیے",
    "profile.edit.pwMismatch": "پاس ورڈ مماثل نہیں ہیں",
    "profile.edit.pwUpdated": "پاس ورڈ اپ ڈیٹ ہو گیا",
    "profile.edit.newEmail": "نیا ای میل ایڈریس",
    "profile.edit.newEmailPh": "new@example.com",
    "profile.edit.saveEmail": "ای میل اپ ڈیٹ کریں",
    "profile.edit.emailInvalid": "درست ای میل ایڈریس درج کریں",
    "profile.edit.emailUpdated": "ای میل اپ ڈیٹ ہو گیا",

    "profile.addr.title": "محفوظ شدہ پتے",
    "profile.addr.empty": "ابھی کوئی پتہ محفوظ نہیں۔ نیچے شامل کریں۔",
    "profile.addr.addNew": "نیا پتہ شامل کریں",
    "profile.addr.addTitle": "نیا پتہ شامل کریں",
    "profile.addr.type": "پتے کی قسم",
    "profile.addr.field": "پتہ",
    "profile.addr.placeholder": "گھر نمبر، گلی، علاقہ، شہر",
    "profile.addr.save": "پتہ محفوظ کریں",
    "profile.addr.cancel": "منسوخ کریں",
    "profile.addr.required": "پتہ درکار ہے",
    "profile.addr.saved": "کا پتہ محفوظ ہو گیا",
    "profile.addr.removed": "کا پتہ حذف ہو گیا",
    "profile.addr.label.Home": "گھر",
    "profile.addr.label.Office": "دفتر",
    "profile.addr.label.Other": "دیگر",

    "location.headingA": "اگلی اسکرین پر",
    "location.headingB": "مقام تک رسائی",
    "location.headingC": "کی اجازت دیں:",
    "location.benefit1.title": "آپ کے قریب دستیاب مصنوعات",
    "location.benefit1.desc":
      "ہمیں اس علاقے میں ڈیلیوری کے لیے دستیاب مصنوعات چیک کرنے کے لیے آپ کے مقام کی ضرورت ہے۔",
    "location.benefit2.title": "درست ڈیلیوری",
    "location.benefit2.desc":
      "اپنے مقام کے لیے درست ڈیلیوری کے اختیارات، تخمینی وقت اور ریئل ٹائم آرڈر اپڈیٹس حاصل کریں۔",
    "location.continue": "جاری رکھیں",
    "location.requesting": "مقام حاصل کیا جا رہا ہے…",
    "location.granted": "مقام تک رسائی دے دی گئی",
    "location.denied": "مقام کی اجازت نہیں دی گئی — آپ بعد میں فعال کر سکتے ہیں",
    "location.unavailable": "اس ڈیوائس پر مقام دستیاب نہیں ہے",

    "address.title": "آپ کا پتہ کیا ہے؟",
    "address.placeholder": "اپنا پتہ درج کریں",
    "address.confirm": "تصدیق کریں",
    "address.saved": "پتہ محفوظ ہو گیا (صرف ڈیمو)",
    "address.locate": "موجودہ مقام استعمال کریں",
    "address.locateMock": "اس ڈیمو میں موجودہ مقام فرضی ہے",
    "address.satelliteAlt": "سیٹلائٹ نقشے کا پیش منظر",

    "agent.menu": "مینیو کھولیں",
    "agent.orbLabel": "یہاں ٹیپ کریں",
    "agent.greetingUrdu": "میں کیا لاؤں آپ کے لیے؟",
    "agent.greetingRoman": "Main kya laoon aap ke liye?",
    "agent.tapToSpeak": "بولنے کے لیے ٹیپ کریں یا اپنا آرڈر ٹائپ کریں",
    "agent.categories": "اقسام",
    "agent.seeAll": "سب دیکھیں",
    "agent.popular": "مقبول اشیاء",
    "agent.cart": "کارٹ کھولیں",
    "agent.cartCount": "3",
    "agent.typePlaceholder": "جو کچھ آرڈر کرنا ہے یہاں لکھیں…",
    "agent.send": "آرڈر پیغام بھیجیں",
    "agent.mockMessage": "آرڈر پیغام موصول ہو گیا (ڈیمو)",
    "agent.mockVoice": "اس ڈیمو میں وائس آرڈرنگ فرضی ہے",
    "agent.mockAction": "یہ عمل اس ڈیمو میں فرضی ہے",
    "agent.cat.groceries": "کریانہ",
    "agent.cat.beverages": "مشروبات",
    "agent.cat.dairy": "ڈیری",
    "agent.cat.snacks": "سنیکس",
    "agent.item.milk": "تازہ دودھ 1L",
    "agent.item.cola": "کوکا کولا 1.5L",
    "agent.item.bread": "بریڈ سلائس",
    "agent.item.eggs": "انڈے (30 پیک)",
  },
};

type TranslateFn = (key: string) => string;

type LanguageContextValue = {
  language: Language;
  setLanguage: (next: Language) => void;
  t: TranslateFn;
};

// Keep a single context instance across Vite HMR module reloads, otherwise
// provider and consumer can end up bound to different context objects.
const globalStore = globalThis as unknown as {
  __retailaiLanguageContext?: Context<LanguageContextValue | null>;
};
const LanguageContext =
  globalStore.__retailaiLanguageContext ??
  (globalStore.__retailaiLanguageContext = createContext<LanguageContextValue | null>(null));

function readStoredLanguage(): Language {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "ur" || stored === "en" ? stored : "en";
  } catch {
    return "en";
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  // Hydrate from localStorage after mount (SSR-safe).
  useEffect(() => {
    setLanguageState(readStoredLanguage());
  }, []);

  // Keep <html lang> and text direction in sync (Urdu is RTL).
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ur" ? "rtl" : "ltr";
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage: (next) => {
        setLanguageState(next);
        try {
          window.localStorage.setItem(STORAGE_KEY, next);
        } catch {
          /* storage unavailable in this prototype */
        }
      },
      t: (key) => translations[language][key] ?? key,
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  // Fall back to English instead of crashing the screen if a consumer renders
  // outside the provider (e.g. during an HMR reload).
  if (!ctx) {
    return {
      language: "en",
      setLanguage: () => {},
      t: (key) => translations.en[key] ?? key,
    };
  }
  return ctx;
}
