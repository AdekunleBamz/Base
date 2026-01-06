// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/access/Ownable.sol";

contract AddressBook is Ownable(msg.sender) {
    // Define a private salt value for internal use
    string private salt = "value"; 

    // Define a struct to represent a contact
    struct Contact {
        uint id; // Unique identifier for the contact
        string firstName; // First name of the contact
        string lastName; // Last name of the contact
        uint[] phoneNumbers; // Array to store multiple phone numbers for the contact
    }

    // Array to store all contacts
    Contact[] private contacts;

    // Mapping to store the index of each contact in the contacts array using its ID
    mapping(uint => uint) private idToIndex;

    // Variable to keep track of the ID for the next contact
    uint private nextId = 1;

    // Custom error for when a contact is not found
    error ContactNotFound(uint id);

    // Bulk operations constants
    uint256 public constant MAX_BULK_ADD = 25;
    uint256 public constant MAX_BULK_DELETE = 30;
    uint256 public constant MAX_BULK_RETRIEVE = 50;

    // Events for bulk operations
    event BulkContactsAdded(uint256 count, uint256 startId);
    event BulkContactsDeleted(uint256 count);
    event BulkContactsRetrieved(address indexed requester, uint256 count);

    // Function to add a new contact
    function addContact(string calldata firstName, string calldata lastName, uint[] calldata phoneNumbers) external onlyOwner {
        // Create a new contact with the provided details and add it to the contacts array
        contacts.push(Contact(nextId, firstName, lastName, phoneNumbers));
        // Map the ID of the new contact to its index in the array
        idToIndex[nextId] = contacts.length - 1;
        // Increment the nextId for the next contact
        nextId++;
    }

    // Function to delete a contact by its ID
    function deleteContact(uint id) external onlyOwner {
        // Get the index of the contact to be deleted
        uint index = idToIndex[id];
        // Check if the index is valid and if the contact with the provided ID exists
        if (index >= contacts.length || contacts[index].id != id) revert ContactNotFound(id);

        // Replace the contact to be deleted with the last contact in the array
        contacts[index] = contacts[contacts.length - 1];
        // Update the index mapping for the moved contact
        idToIndex[contacts[index].id] = index;
        // Remove the last contact from the array
        contacts.pop();
        // Delete the mapping entry for the deleted contact ID
        delete idToIndex[id];
    }

    // Function to retrieve a contact by its ID
    function getContact(uint id) external view returns (Contact memory) {
        // Get the index of the contact
        uint index = idToIndex[id];
        // Check if the index is valid and if the contact with the provided ID exists
        if (index >= contacts.length || contacts[index].id != id) revert ContactNotFound(id);
        // Return the contact details
        return contacts[index];
    }

    // Function to retrieve all contacts
    function getAllContacts() external view returns (Contact[] memory) {
        // Return the array of all contacts
        return contacts;
    }

    /*//////////////////////////////////////////////////////////////
                           BULK OPERATIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Add multiple contacts in a single transaction
    /// @param firstNames Array of first names
    /// @param lastNames Array of last names
    /// @param phoneNumbersArray Array of phone number arrays for each contact
    function bulkAddContacts(
        string[] calldata firstNames,
        string[] calldata lastNames,
        uint[][] calldata phoneNumbersArray
    ) external onlyOwner {
        uint256 count = firstNames.length;
        require(count > 0 && count <= MAX_BULK_ADD, "Invalid bulk add count");
        require(
            lastNames.length == count && phoneNumbersArray.length == count,
            "Array length mismatch"
        );

        uint256 startId = nextId;

        for (uint256 i = 0; i < count; i++) {
            require(bytes(firstNames[i]).length > 0 && bytes(lastNames[i]).length > 0, "Empty name");
            require(phoneNumbersArray[i].length > 0, "No phone numbers");

            contacts.push(Contact(nextId, firstNames[i], lastNames[i], phoneNumbersArray[i]));
            idToIndex[nextId] = contacts.length - 1;
            nextId++;
        }

        emit BulkContactsAdded(count, startId);
    }

    /// @notice Delete multiple contacts in a single transaction
    /// @param ids Array of contact IDs to delete (max 30)
    function bulkDeleteContacts(uint256[] calldata ids) external onlyOwner {
        uint256 count = ids.length;
        require(count > 0 && count <= MAX_BULK_DELETE, "Invalid bulk delete count");

        uint256 deletedCount = 0;

        for (uint256 i = 0; i < count; i++) {
            uint256 id = ids[i];
            uint256 index = idToIndex[id];

            // Skip if contact doesn't exist
            if (index >= contacts.length || contacts[index].id != id) {
                continue;
            }

            // Replace with last contact
            contacts[index] = contacts[contacts.length - 1];
            idToIndex[contacts[index].id] = index;
            contacts.pop();
            delete idToIndex[id];
            deletedCount++;
        }

        emit BulkContactsDeleted(deletedCount);
    }

    /// @notice Retrieve multiple contacts by their IDs
    /// @param ids Array of contact IDs to retrieve (max 50)
    /// @return retrievedContacts Array of retrieved contacts
    function bulkGetContacts(uint256[] calldata ids) external view returns (Contact[] memory retrievedContacts) {
        uint256 count = ids.length;
        require(count > 0 && count <= MAX_BULK_RETRIEVE, "Invalid bulk retrieve count");

        retrievedContacts = new Contact[](count);

        for (uint256 i = 0; i < count; i++) {
            uint256 id = ids[i];
            uint256 index = idToIndex[id];

            if (index < contacts.length && contacts[index].id == id) {
                retrievedContacts[i] = contacts[index];
            }
            // If contact not found, array element remains default (id = 0)
        }

        emit BulkContactsRetrieved(msg.sender, count);
    }

    /// @notice Get a range of contacts
    /// @param startIndex Starting index (inclusive)
    /// @param count Number of contacts to retrieve (max 50)
    /// @return contactsRange Array of contacts in the range
    function getContactsRange(uint256 startIndex, uint256 count) external view returns (Contact[] memory contactsRange) {
        require(count > 0 && count <= MAX_BULK_RETRIEVE, "Invalid range count");
        require(startIndex < contacts.length, "Start index out of bounds");
        require(startIndex + count <= contacts.length, "Range exceeds array length");

        contactsRange = new Contact[](count);

        for (uint256 i = 0; i < count; i++) {
            contactsRange[i] = contacts[startIndex + i];
        }
    }

    /// @notice Update multiple contacts' phone numbers
    /// @param ids Array of contact IDs to update
    /// @param newPhoneNumbers Array of new phone number arrays
    function bulkUpdatePhoneNumbers(
        uint256[] calldata ids,
        uint[][] calldata newPhoneNumbers
    ) external onlyOwner {
        uint256 count = ids.length;
        require(count > 0 && count <= MAX_BULK_ADD, "Invalid bulk update count");
        require(newPhoneNumbers.length == count, "Array length mismatch");

        for (uint256 i = 0; i < count; i++) {
            uint256 id = ids[i];
            uint256 index = idToIndex[id];

            require(index < contacts.length && contacts[index].id == id, "Contact not found");
            require(newPhoneNumbers[i].length > 0, "No phone numbers");

            contacts[index].phoneNumbers = newPhoneNumbers[i];
        }
    }

    /// @notice Search contacts by name (case-insensitive partial match)
    /// @param searchTerm The search term to match against names
    /// @param maxResults Maximum number of results to return
    /// @return foundIds Array of contact IDs that match the search
    function searchContacts(string calldata searchTerm, uint256 maxResults) external view returns (uint256[] memory foundIds) {
        require(maxResults > 0 && maxResults <= MAX_BULK_RETRIEVE, "Invalid max results");

        uint256[] memory tempResults = new uint256[](maxResults);
        uint256 resultCount = 0;

        bytes memory searchBytes = bytes(searchTerm);
        if (searchBytes.length == 0) {
            return new uint256[](0);
        }

        for (uint256 i = 0; i < contacts.length && resultCount < maxResults; i++) {
            Contact storage contact = contacts[i];

            // Check if search term appears in first or last name (case-insensitive)
            if (_containsSubstringCaseInsensitive(contact.firstName, searchTerm) ||
                _containsSubstringCaseInsensitive(contact.lastName, searchTerm)) {
                tempResults[resultCount] = contact.id;
                resultCount++;
            }
        }

        // Resize array to actual result count
        foundIds = new uint256[](resultCount);
        for (uint256 i = 0; i < resultCount; i++) {
            foundIds[i] = tempResults[i];
        }
    }

    /// @notice Get contact statistics
    /// @return totalContacts Total number of contacts
    /// @return totalPhoneNumbers Total number of phone numbers across all contacts
    /// @return averagePhonesPerContact Average phone numbers per contact
    function getContactStats() external view returns (
        uint256 totalContacts,
        uint256 totalPhoneNumbers,
        uint256 averagePhonesPerContact
    ) {
        totalContacts = contacts.length;

        for (uint256 i = 0; i < contacts.length; i++) {
            totalPhoneNumbers += contacts[i].phoneNumbers.length;
        }

        averagePhonesPerContact = totalContacts > 0 ? totalPhoneNumbers / totalContacts : 0;
    }

    /// @notice Get bulk operation limits
    function getBulkLimits() external pure returns (
        uint256 maxBulkAdd,
        uint256 maxBulkDelete,
        uint256 maxBulkRetrieve
    ) {
        return (MAX_BULK_ADD, MAX_BULK_DELETE, MAX_BULK_RETRIEVE);
    }

    /// @notice Estimate gas for bulk operations
    /// @param operationCount Number of operations
    /// @param operationType 0=add, 1=delete, 2=retrieve, 3=update
    function estimateBulkGas(uint256 operationCount, uint256 operationType) external pure returns (uint256) {
        require(operationCount > 0, "Invalid count");

        uint256 baseGas = 21000;
        uint256 gasPerOperation;

        if (operationType == 0) {
            // Add operations (storage writes, complex data)
            gasPerOperation = operationCount <= MAX_BULK_ADD ? 75000 : 90000;
            require(operationCount <= MAX_BULK_ADD, "Too many add operations");
        } else if (operationType == 1) {
            // Delete operations (storage modifications)
            gasPerOperation = 35000;
            require(operationCount <= MAX_BULK_DELETE, "Too many delete operations");
        } else if (operationType == 2) {
            // Retrieve operations (storage reads)
            gasPerOperation = 8000;
            require(operationCount <= MAX_BULK_RETRIEVE, "Too many retrieve operations");
        } else if (operationType == 3) {
            // Update operations (storage writes)
            gasPerOperation = 45000;
            require(operationCount <= MAX_BULK_ADD, "Too many update operations");
        } else {
            revert("Invalid operation type");
        }

        return baseGas + (gasPerOperation * operationCount);
    }

    /// @notice Internal helper function for case-insensitive substring search
    function _containsSubstringCaseInsensitive(string memory haystack, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);

        if (n.length > h.length) {
            return false;
        }

        // Convert both strings to lowercase for comparison
        bytes memory hLower = new bytes(h.length);
        bytes memory nLower = new bytes(n.length);

        for (uint256 i = 0; i < h.length; i++) {
            if (h[i] >= 0x41 && h[i] <= 0x5A) {
                hLower[i] = bytes1(uint8(h[i]) + 32);
            } else {
                hLower[i] = h[i];
            }
        }

        for (uint256 i = 0; i < n.length; i++) {
            if (n[i] >= 0x41 && n[i] <= 0x5A) {
                nLower[i] = bytes1(uint8(n[i]) + 32);
            } else {
                nLower[i] = n[i];
            }
        }

        for (uint256 i = 0; i <= hLower.length - nLower.length; i++) {
            bool found = true;
            for (uint256 j = 0; j < nLower.length; j++) {
                if (hLower[i + j] != nLower[j]) {
                    found = false;
                    break;
                }
            }
            if (found) {
                return true;
            }
        }

        return false;
    }
}
