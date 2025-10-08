"use client";
import Image from "next/image";

import React from "react";

type Props = {
  authMode: "login" | "signup";
  authForm: { email: string; password: string; name: string };
  authLoading: boolean;
  error: React.ReactNode;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  setAuthMode: (m: "login" | "signup") => void;
};

export default function AuthCard({
  authMode,
  authForm,
  authLoading,
  error,
  onChange,
  onSubmit,
  setAuthMode,
}: Props) {
  return (
    <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-10 border border-green-100 mx-auto">
      <div className="flex flex-col items-center mb-8">
        <Image
          src="/logo-blue.png"
          alt="Logo"
          width={80}
          height={80}
          className="h-20 mb-6"
        />
        <h2 className="text-4xl font-extrabold text-green-800 mb-2 text-center">
          Log in to your account
        </h2>
        <p className="text-gray-500 text-center mb-6 text-lg">
          Welcome back! Please enter your details.
        </p>
        <div className="flex w-full mb-6 rounded-xl overflow-hidden border border-green-200">
          <button
            type="button"
            className={`flex-1 py-3 text-xl font-semibold transition-colors ${authMode === "signup" ? "bg-green-50 text-green-800" : "bg-white text-gray-500"}`}
            style={{ borderRight: "1px solid #d1fae5" }}
            onClick={() => setAuthMode("signup")}
          >
            Sign up
          </button>
          <button
            type="button"
            className={`flex-1 py-3 text-xl font-semibold transition-colors ${authMode === "login" ? "bg-green-50 text-green-800" : "bg-white text-gray-500"}`}
            onClick={() => setAuthMode("login")}
          >
            Log in
          </button>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        {authMode === "signup" && (
          <div>
            <label className="block text-green-800 font-semibold mb-2">
              Full Name
            </label>
            <input
              type="text"
              name="name"
              value={authForm.name}
              onChange={onChange}
              className="w-full rounded-xl border border-green-200 px-5 py-3 text-base focus:border-green-500 focus:ring-2 focus:ring-green-100"
              placeholder="Your full name"
              required
            />
          </div>
        )}
        <div>
          <label className="block text-green-800 font-semibold mb-2">
            Email
          </label>
          <input
            type="email"
            name="email"
            value={authForm.email}
            onChange={onChange}
            className="w-full rounded-xl border border-green-200 px-5 py-3 text-base focus:border-green-500 focus:ring-2 focus:ring-green-100"
            placeholder="Enter your email"
            required
          />
        </div>
        <div>
          <label className="block text-green-800 font-semibold mb-2">
            Password
          </label>
          <input
            type="password"
            name="password"
            value={authForm.password}
            onChange={onChange}
            className="w-full rounded-xl border border-green-200 px-5 py-3 text-base focus:border-green-500 focus:ring-2 focus:ring-green-100"
            placeholder="Enter your password"
            minLength={6}
            required
          />
        </div>
        {error && (
          <div className="text-red-600 text-sm font-medium text-center">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={authLoading}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl transition-colors text-2xl"
        >
          {authLoading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-3"></div>
              {authMode === "login" ? "Signing in..." : "Creating account..."}
            </div>
          ) : authMode === "login" ? (
            "Sign in"
          ) : (
            "Sign up"
          )}
        </button>
      </form>
    </div>
  );
}
