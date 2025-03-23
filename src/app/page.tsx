// src/app/page.tsx
import Link from 'next/link';
import Image from 'next/image';
import { FaCheckCircle, FaBroom, FaMoneyBillWave, FaBook, FaListUl, FaComments } from 'react-icons/fa';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-3xl font-bold text-emerald-800">Roomies</h1>
        </div>
        <div className="hidden md:flex space-x-8">
          <Link href="/features" className="text-gray-700 hover:text-emerald-600">Features</Link>
          <Link href="/pricing" className="text-gray-700 hover:text-emerald-600">Pricing</Link>
          <Link href="/about" className="text-gray-700 hover:text-emerald-600">About</Link>
        </div>
        <div>
          <Link href="/login" className="mr-4 text-gray-700 hover:text-emerald-600">Login</Link>
          <Link href="/signup" className="bg-emerald-700 hover:bg-emerald-800 text-white py-2 px-4 rounded-md">
            Sign Up Free
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-12 md:py-24 flex flex-col md:flex-row items-center">
        <div className="md:w-1/2 mb-12 md:mb-0">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">
            Roommate Living 
            <br />Made Easy
          </h2>
          <div className="space-y-4 mb-8">
            <div className="flex items-center">
              <FaCheckCircle className="text-emerald-500 mr-2" />
              <p className="text-gray-700">Manage chores, bills, and house rules</p>
            </div>
            <div className="flex items-center">
              <FaCheckCircle className="text-emerald-500 mr-2" />
              <p className="text-gray-700">Get organized in 5 minutes or less</p>
            </div>
            <div className="flex items-center">
              <FaCheckCircle className="text-emerald-500 mr-2" />
              <p className="text-gray-700">Free for up to 4 roommates</p>
            </div>
          </div>
          <Link href="/signup" className="bg-emerald-700 hover:bg-emerald-800 text-white py-3 px-6 rounded-md text-lg font-medium inline-block">
            Create Your House
          </Link>
        </div>
        <div className="md:w-1/2">
          <div className="relative h-80 w-full">
            <Image 
              src="/roommate-dashboard.png" 
              alt="Roomies dashboard preview" 
              fill
              className="object-contain rounded-lg shadow-lg"
              priority
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-16">The Roomies Difference</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Feature 1 */}
            <div className="flex flex-col items-center text-center">
              <div className="bg-neutral-100 p-6 rounded-full mb-4">
                <FaBroom className="text-4xl text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Chore Management</h3>
              <p className="text-gray-600">
                Create and assign chores with automated rotation and reminders for everyone.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="flex flex-col items-center text-center">
              <div className="bg-neutral-100 p-6 rounded-full mb-4">
                <FaMoneyBillWave className="text-4xl text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Bill Splitting</h3>
              <p className="text-gray-600">
                Track expenses, split bills, and settle up easily with integrated payment solutions.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="flex flex-col items-center text-center">
              <div className="bg-neutral-100 p-6 rounded-full mb-4">
                <FaBook className="text-4xl text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">House Rules</h3>
              <p className="text-gray-600">
                Document and share house rules to keep everyone on the same page.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="flex flex-col items-center text-center">
              <div className="bg-neutral-100 p-6 rounded-full mb-4">
                <FaComments className="text-4xl text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Chat & Todo Lists</h3>
              <p className="text-gray-600">
                Communicate easily and manage shared to-do lists in one place.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-emerald-700 py-16">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Ready to simplify roommate living?</h2>
          <p className="text-white text-lg mb-8 max-w-2xl mx-auto">
            Join thousands of happy roommates who use Roomies to manage their shared living space.
          </p>
          <Link href="/signup" className="bg-white text-emerald-700 py-3 px-8 rounded-md text-lg font-medium hover:bg-neutral-100">
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-neutral-800 text-white py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between">
            <div className="mb-8 md:mb-0">
              <h3 className="text-2xl font-bold mb-4">Roomies</h3>
              <p className="text-neutral-300 max-w-xs">
                The complete solution for managing your shared living space.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
              <div>
                <h4 className="text-lg font-semibold mb-4">Product</h4>
                <ul className="space-y-2">
                  <li><Link href="/features" className="text-neutral-300 hover:text-white">Features</Link></li>
                  <li><Link href="/pricing" className="text-neutral-300 hover:text-white">Pricing</Link></li>
                  <li><Link href="/faq" className="text-neutral-300 hover:text-white">FAQ</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-lg font-semibold mb-4">Company</h4>
                <ul className="space-y-2">
                  <li><Link href="/about" className="text-neutral-300 hover:text-white">About Us</Link></li>
                  <li><Link href="/blog" className="text-neutral-300 hover:text-white">Blog</Link></li>
                  <li><Link href="/contact" className="text-neutral-300 hover:text-white">Contact</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-lg font-semibold mb-4">Legal</h4>
                <ul className="space-y-2">
                  <li><Link href="/terms" className="text-neutral-300 hover:text-white">Terms</Link></li>
                  <li><Link href="/privacy" className="text-neutral-300 hover:text-white">Privacy</Link></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t border-neutral-700 mt-12 pt-8 text-center text-neutral-400">
            <p>&copy; {new Date().getFullYear()} Roomies. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}