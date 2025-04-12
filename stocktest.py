from nepse import NEPSE

# Initialize Nepse API
nepse = NEPSE()

# Disable TLS verification temporarily (due to SSL certificate issue)
nepse.setTLSVerification(False)

# Fetch the company list
company_list = nepse.getCompanyList()

# Print the fetched company list
print(company_list)
