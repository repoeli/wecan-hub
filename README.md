# wecan-hub

## Project Overview
The wecan-hub project is designed to provide a comprehensive solution for managing various services and integrations, including Supabase, Vercel, SendGrid, and Twilio.

## Setup Instructions

### Prerequisites
- Node.js ≥ 18 (use `nvm install 18 && nvm use 18` to install via nvm)
- pnpm or yarn (install with `npm install -g pnpm` or `npm install -g yarn`)

### Installing Supabase CLI on Windows

#### Option 1: Using Scoop
If you have Scoop installed, you can install the Supabase CLI by running:
```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

#### Option 2: Using Chocolatey
Alternatively, you can use Chocolatey to install the Supabase CLI:
```bash
choco install supabase
```
*If you haven't installed Chocolatey, follow the instructions at https://chocolatey.org/install*

#### Option 3: Manual Installation
For manual installation, download the latest Supabase CLI executable from the [Supabase CLI releases page](https://github.com/supabase/cli/releases) and add it to your system's PATH.

### Other Platforms
Refer to the [Supabase CLI documentation](https://github.com/supabase/cli#install-the-cli) for the supported package manager on other platforms.

### Install the Vercel CLI
To install the Vercel CLI, run the following command:
```bash
npm install -g vercel
```

3. **Set Up Credentials**
   - Set up test credentials for SendGrid and Twilio. Refer to their respective documentation for instructions on obtaining API keys and configuring your environment.

4. **Version Control**
   - Create a GitHub repository for version control. Follow the instructions on GitHub to create a new repository and link it to your local project.

## Usage Guidelines
- Follow the setup instructions to configure your environment.
- Use the provided tools and services as per your project requirements.
- Refer to the documentation of each service for detailed usage instructions.