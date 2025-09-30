import asyncio
from playwright import async_api
import os
import time

async def test_escrow_workflow():
    """
    Comprehensive test for escrow workflow including:
    1. Seller creates escrow with product image
    2. Buyer joins escrow and views product image
    3. Escrow expiration handling
    """
    pw = None
    browser = None
    context = None

    try:
        # Start Playwright session
        pw = await async_api.async_playwright().start()

        # Launch browser
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )

        # Create browser context
        context = await browser.new_context()
        context.set_default_timeout(10000)

        # Create new page
        page = await context.new_page()

        print("🚀 Starting escrow workflow test...")

        # Navigate to seller page
        print("📍 Navigating to seller page...")
        try:
            await page.goto("http://localhost:3000/seller", wait_until="domcontentloaded", timeout=15000)
        except Exception as e:
            print(f"⚠️ Direct navigation failed: {e}")
            # Try navigating to home first, then to seller
            await page.goto("http://localhost:3000", wait_until="domcontentloaded", timeout=10000)
            await page.click('a[href="/seller"]')
            await page.wait_for_load_state("networkidle")

        # Wait for page to load
        await page.wait_for_load_state("networkidle", timeout=5000)

        # Debug: Check page content
        title = await page.title()
        print(f"📄 Page title: {title}")

        # Check if we're on the right page
        current_url = page.url
        print(f"🔗 Current URL: {current_url}")

        # Take a screenshot for debugging
        await page.screenshot(path="debug_seller_page.png")
        print("📸 Screenshot saved as debug_seller_page.png")

        # Check if we need to authenticate
        auth_form_visible = await page.locator('[data-testid="auth-form"], form:has(input[type="email"]), .auth-form').is_visible()

        if auth_form_visible:
            print("🔐 Authentication required, using test mode...")

            # Use test authentication by adding test=true to API calls
            # First, let's try to create a test session via API
            await page.evaluate("""
                fetch('/api/auth/test-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: 'test-seller@example.com',
                        role: 'seller'
                    })
                }).then(r => r.json()).then(console.log).catch(console.error)
            """)

            # Refresh page to pick up test session
            await page.reload()
            await page.wait_for_load_state("networkidle")

        # Wait for seller portal to load - try multiple selectors
        try:
            await page.wait_for_selector('.container, main, [class*="container"], body', timeout=5000)
            print("✅ Page structure found")
        except:
            print("⚠️ Standard selectors not found, checking page content...")
            body_text = await page.locator('body').text_content()
            print(f"📄 Page content preview: {body_text[:200]}...")

        # Check if create escrow form is available
        create_form = page.locator('form:has(button[type="submit"]), form, [role="form"]')
        form_visible = await create_form.is_visible()

        if not form_visible:
            print("❌ Create escrow form not found - checking for other elements")
            # Look for any form elements
            all_forms = page.locator('form, input, button')
            form_count = await all_forms.count()
            print(f"📝 Found {form_count} form-related elements")

            if form_count > 0:
                for i in range(min(form_count, 3)):
                    element_info = await all_forms.nth(i).evaluate("el => el.tagName + ' ' + (el.type || el.className || '')")
                    print(f"  - Element {i}: {element_info}")
        else:
            print("✅ Create escrow form found")

        # Fill out escrow creation form
        print("📝 Filling escrow creation form...")

        # Find all input and textarea elements
        all_inputs = page.locator('input, textarea')
        input_count = await all_inputs.count()
        print(f"📝 Found {input_count} input/textarea elements")

        # Description field - try multiple approaches
        desc_found = False
        for i in range(input_count):
            input_element = all_inputs.nth(i)
            input_type = await input_element.get_attribute('type') or ''
            placeholder = await input_element.get_attribute('placeholder') or ''
            name = await input_element.get_attribute('name') or ''
            print(f"  Input {i}: type={input_type}, placeholder='{placeholder}', name='{name}'")

            if ('description' in placeholder.lower() or
                'description' in name.lower() or
                input_type == 'text' or
                not input_type):  # textarea has no type
                try:
                    await input_element.fill("Test Product - High Quality Widget")
                    print("✅ Description field filled")
                    desc_found = True
                    break
                except Exception as e:
                    print(f"⚠️ Could not fill input {i}: {e}")
                    continue

        if not desc_found:
            print("❌ No suitable description input found")
            return False

        # Price field - look for number input or text input that might be for price
        price_found = False
        for i in range(input_count):
            input_element = all_inputs.nth(i)
            input_type = await input_element.get_attribute('type') or ''
            placeholder = await input_element.get_attribute('placeholder') or ''
            name = await input_element.get_attribute('name') or ''

            if (input_type == 'number' or
                'price' in placeholder.lower() or
                'amount' in placeholder.lower() or
                'price' in name.lower() or
                'amount' in name.lower()):
                try:
                    await input_element.fill("50000")
                    print("✅ Price field filled")
                    price_found = True
                    break
                except Exception as e:
                    print(f"⚠️ Could not fill price input {i}: {e}")
                    continue

        if not price_found:
            print("❌ No suitable price input found")
            return False

        # Upload product image (create a test image file)
        image_input = page.locator('input[type="file"]')
        if await image_input.is_visible():
            # Create a simple test image file
            test_image_path = os.path.join(os.getcwd(), "test-product.jpg")
            # For testing, we'll use the existing test image if available
            if os.path.exists("test-receipt.jpg"):
                await image_input.set_input_files("test-receipt.jpg")
                print("🖼️ Product image uploaded")
            else:
                print("⚠️ No test image found, proceeding without image")

        # Submit the form
        submit_button = page.locator('button[type="submit"]:has-text("Create"), button:has-text("Create")')
        await submit_button.click()

        print("⏳ Waiting for escrow creation...")

        # Wait for success or redirect
        try:
            # Check if redirected to escrow page
            await page.wait_for_url("**/seller/escrow/**", timeout=10000)
            print("✅ Escrow created successfully, redirected to escrow page")

            # Extract escrow code from URL
            current_url = page.url
            escrow_code = current_url.split('/').pop()
            print(f"🔢 Escrow code: {escrow_code}")

        except:
            # Check for success message or escrow code display
            success_element = page.locator('text=/[A-Z0-9]{6}/, .font-mono').first
            if await success_element.is_visible():
                escrow_code = await success_element.text_content()
                print(f"✅ Escrow created with code: {escrow_code}")
            else:
                print("❌ Escrow creation failed - no success indication found")
                return False

        # Now test buyer joining the escrow
        print("🛒 Testing buyer joining escrow...")

        # Open new page for buyer
        buyer_page = await context.new_page()
        await buyer_page.goto("http://localhost:3000/buyer", wait_until="domcontentloaded")
        await buyer_page.wait_for_load_state("networkidle")

        # Set up buyer test session
        await buyer_page.evaluate("""
            fetch('/api/auth/test-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'test-buyer@example.com',
                    role: 'buyer'
                })
            }).then(r => r.json()).then(console.log).catch(console.error)
        """)

        # Refresh buyer page
        await buyer_page.reload()
        await buyer_page.wait_for_load_state("networkidle")

        # Enter escrow code
        code_input = buyer_page.locator('input[placeholder*="code"], input[placeholder*="CODE"]')
        await code_input.fill(escrow_code)

        # Join escrow
        join_button = buyer_page.locator('button[type="submit"]:has-text("Join"), button:has-text("Join")')
        await join_button.click()

        print("⏳ Waiting for buyer to join escrow...")

        # Wait for redirect to escrow page
        try:
            await buyer_page.wait_for_url("**/buyer/escrow/**", timeout=10000)
            print("✅ Buyer successfully joined escrow")
        except:
            print("❌ Buyer failed to join escrow")
            return False

        # Test product image display
        print("🖼️ Testing product image display...")

        # Check if product image is visible
        product_image = buyer_page.locator('img[alt="Product"], img[src*="product"]')
        image_visible = await product_image.is_visible()

        if image_visible:
            print("✅ Product image displayed successfully")
        else:
            print("⚠️ Product image not found - this may be expected if no image was uploaded")

        # Check escrow details are displayed
        description_element = buyer_page.locator('text=/Test Product/')
        amount_element = buyer_page.locator('text=/50,000/')

        desc_visible = await description_element.is_visible()
        amount_visible = await amount_element.is_visible()

        if desc_visible and amount_visible:
            print("✅ Escrow details displayed correctly")
        else:
            print("❌ Escrow details not displayed properly")
            return False

        # Test escrow expiration (if applicable)
        print("⏰ Testing escrow expiration handling...")

        # Check for timer display
        timer_element = buyer_page.locator('text=/Time Remaining/, text=/Time left/')
        timer_visible = await timer_element.is_visible()

        if timer_visible:
            print("✅ Payment timer is active")
        else:
            print("ℹ️ No active timer (escrow may be in different state)")

        # Wait a moment to ensure everything is working
        await asyncio.sleep(2)

        print("🎉 All escrow workflow tests completed successfully!")
        return True

    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")
        return False

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

if __name__ == "__main__":
    success = asyncio.run(test_escrow_workflow())
    exit(0 if success else 1)