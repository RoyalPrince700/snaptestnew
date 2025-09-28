import React from 'react'
import ReactMarkdown from 'react-markdown'
import EnhancedAnswer from './EnhancedAnswer'

// Example of the old plain response vs new enhanced response
const SAMPLE_RESPONSE = {
  old: "Our solar system is a vast and complex celestial structure comprising eight planets, five dwarf planets, numerous moons, asteroids, comets, and other smaller bodies. At its center is the Sun, a massive ball of hot, glowing gas that provides light and heat to the planets. The four inner planets - Mercury, Venus, Earth, and Mars - are rocky and relatively small, with Earth being the only known haven for life. The four outer planets - Jupiter, Saturn, Uranus, and Neptune - are gas giants, primarily composed of hydrogen and helium. Jupiter is the largest planet, with a massive storm system known as the Great Red Spot. The solar system also includes dwarf planets like Pluto, Eris, and Ceres, which are smaller and more icy. Moons orbit many of the planets, with Jupiter's moon Ganymede being the largest in the solar system. Asteroids and comets are smaller, rocky or icy bodies that orbit the Sun, sometimes passing close to the planets. The solar system is estimated to be around 4.6 billion years old and is thought to have formed from a giant cloud of gas and dust called a solar nebula.",
  
  enhanced: "Hey Joseph! 🌟 Let me blow your mind with our incredible solar system - it's like the ultimate cosmic neighborhood that's been our home for 4.6 billion years! At the center sits our amazing Sun ☀️, and trust me Joseph, this thing is absolutely massive - it's like a giant cosmic furnace that could fit over a million Earths inside it! The inner region is where things get rocky 🪨 - we've got Mercury 🔥 (so close to the Sun it's basically a cosmic BBQ), Venus 💛 (hotter than your oven at 900°F!), our beautiful Earth 🌍 (the only planet with pizza, so obviously the best), and Mars 🔴 (the red planet that's basically Earth's moody cousin). But wait, there's more! The outer solar system is where the real giants hang out 💨 - Jupiter 🟠 is so massive it could swallow all the other planets and still have room for dessert, plus it has this epic storm called the Great Red Spot that's been raging for centuries! Saturn 💍 is the show-off with its gorgeous rings, Uranus 💎 decided to be different and spins on its side (rebel!), and Neptune 💙 has winds so crazy they'd make hurricanes look like a gentle breeze! Here's a fun fact that'll make your brain do a happy dance, Joseph: Jupiter's moon Ganymede is actually bigger than Mercury - imagine that! This whole cosmic family started from a giant swirling cloud of gas and dust 🌌 - pretty cool how something so chaotic became so perfectly organized, right? Joseph, want me to dive deeper into any of these cosmic wonders?"
}

export default function ResponseComparison() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Response Enhancement Demo</h1>
        <p className="text-gray-600">See how we transformed plain educational content into engaging, visual learning experiences!</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Old Format */}
        <div className="space-y-4">
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-red-800 mb-2">❌ Before: Plain & Boring</h2>
            <p className="text-sm text-red-600">Traditional AI response format</p>
          </div>
          
          <div className="bg-gray-100 text-gray-900 px-4 py-3 rounded-lg">
            <div className="flex items-center mb-1">
              <div className="h-4 w-4 bg-gray-400 rounded mr-2"></div>
              <span className="text-xs opacity-75">AI Assistant</span>
            </div>
            <div className="text-sm prose prose-sm max-w-none">
              <ReactMarkdown>{SAMPLE_RESPONSE.old}</ReactMarkdown>
            </div>
          </div>
        </div>

        {/* New Format */}
        <div className="space-y-4">
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-green-800 mb-2">✅ After: Fun, Personalized & Engaging</h2>
            <p className="text-sm text-green-600">Enhanced format with personal names, humor, emojis, sticky notes, and visual elements</p>
          </div>
          
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 text-gray-900 border-2 border-indigo-200 shadow-sm px-4 py-3 rounded-lg">
            <div className="flex items-center mb-2">
              <div className="relative">
                <div className="h-5 w-5 bg-indigo-600 rounded mr-2"></div>
                <div className="absolute -top-1 -right-1 text-xs">🎓</div>
              </div>
              <span className="text-xs font-semibold text-indigo-700">AI Tutor ✨</span>
            </div>
            <EnhancedAnswer data={{ 
              answer: SAMPLE_RESPONSE.enhanced, 
              citations: [], 
              uncertainty: null 
            }} />
          </div>
        </div>
      </div>

      {/* Features Highlight */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-blue-800 mb-4">🎯 New Features Added</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl mb-2">🎨</div>
            <h4 className="font-semibold text-blue-700">Sticky Notes</h4>
            <p className="text-xs text-blue-600">Content broken into colorful, digestible chunks</p>
          </div>
          <div className="text-center">
            <div className="text-2xl mb-2">🧠</div>
            <h4 className="font-semibold text-blue-700">Mind Maps</h4>
            <p className="text-xs text-blue-600">Visual learning with expandable sections</p>
          </div>
          <div className="text-center">
            <div className="text-2xl mb-2">✨</div>
            <h4 className="font-semibold text-blue-700">Fun Facts</h4>
            <p className="text-xs text-blue-600">Highlighted interesting details and numbers</p>
          </div>
          <div className="text-center">
            <div className="text-2xl mb-2">👋</div>
            <h4 className="font-semibold text-blue-700">Personal Touch</h4>
            <p className="text-xs text-blue-600">Uses student's name and adds friendly humor</p>
          </div>
          <div className="text-center">
            <div className="text-2xl mb-2">🎯</div>
            <h4 className="font-semibold text-blue-700">Learning Suggestions</h4>
            <p className="text-xs text-blue-600">Proactive next steps for deeper learning</p>
          </div>
        </div>
      </div>

      <div className="text-center p-6 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg">
        <h3 className="text-lg font-semibold text-purple-800 mb-2">🚀 Ready for Your Personal Learning Adventure?</h3>
        <p className="text-purple-600">The AI will now know your name, crack jokes, add personality, and make learning feel like chatting with your favorite teacher!</p>
      </div>
    </div>
  )
}
