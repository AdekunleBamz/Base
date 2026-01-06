/**
 * Test suite for AddressBook contract bulk operations
 * Tests bulk contact management, retrieval, and search functionality
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AddressBook Bulk Operations", function () {
  let addressBook;
  let owner;
  let user1;
  let user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const AddressBook = await ethers.getContractFactory("AddressBook");
    addressBook = await AddressBook.deploy();
    await addressBook.waitForDeployment();
  });

  describe("Bulk Contact Addition", function () {
    it("should bulk add contacts successfully", async function () {
      const firstNames = ["John", "Jane", "Bob"];
      const lastNames = ["Doe", "Smith", "Johnson"];
      const phoneNumbers = [
        [1234567890, 9876543210],
        [5551112222],
        [3334445555, 6667778888, 9990001111]
      ];

      await expect(addressBook.bulkAddContacts(firstNames, lastNames, phoneNumbers))
        .to.emit(addressBook, "BulkContactsAdded")
        .withArgs(3, 1);

      // Verify contacts were added
      const contact1 = await addressBook.getContact(1);
      const contact2 = await addressBook.getContact(2);
      const contact3 = await addressBook.getContact(3);

      expect(contact1.firstName).to.equal("John");
      expect(contact1.lastName).to.equal("Doe");
      expect(contact1.phoneNumbers.length).to.equal(2);

      expect(contact2.firstName).to.equal("Jane");
      expect(contact2.phoneNumbers.length).to.equal(1);

      expect(contact3.firstName).to.equal("Bob");
      expect(contact3.phoneNumbers.length).to.equal(3);
    });

    it("should reject bulk add with empty names", async function () {
      const firstNames = ["", "Jane"];
      const lastNames = ["Doe", "Smith"];
      const phoneNumbers = [[1234567890], [5551112222]];

      await expect(addressBook.bulkAddContacts(firstNames, lastNames, phoneNumbers))
        .to.be.revertedWith("Empty name");
    });

    it("should reject bulk add with no phone numbers", async function () {
      const firstNames = ["John", "Jane"];
      const lastNames = ["Doe", "Smith"];
      const phoneNumbers = [[1234567890], []];

      await expect(addressBook.bulkAddContacts(firstNames, lastNames, phoneNumbers))
        .to.be.revertedWith("No phone numbers");
    });

    it("should handle maximum bulk add limit", async function () {
      const maxAdd = await addressBook.MAX_BULK_ADD();
      const firstNames = Array(maxAdd).fill().map((_, i) => `First${i}`);
      const lastNames = Array(maxAdd).fill().map((_, i) => `Last${i}`);
      const phoneNumbers = Array(maxAdd).fill().map(() => [1234567890]);

      await expect(addressBook.bulkAddContacts(firstNames, lastNames, phoneNumbers))
        .to.emit(addressBook, "BulkContactsAdded");
    });

    it("should reject bulk add exceeding maximum limit", async function () {
      const maxAdd = await addressBook.MAX_BULK_ADD();
      const firstNames = Array(Number(maxAdd) + 1).fill().map((_, i) => `First${i}`);
      const lastNames = Array(Number(maxAdd) + 1).fill().map((_, i) => `Last${i}`);
      const phoneNumbers = Array(Number(maxAdd) + 1).fill().map(() => [1234567890]);

      await expect(addressBook.bulkAddContacts(firstNames, lastNames, phoneNumbers))
        .to.be.revertedWith("Invalid bulk add count");
    });
  });

  describe("Bulk Contact Deletion", function () {
    beforeEach(async function () {
      // Add some contacts for testing deletion
      const firstNames = ["John", "Jane", "Bob", "Alice"];
      const lastNames = ["Doe", "Smith", "Johnson", "Brown"];
      const phoneNumbers = [
        [1234567890], [5551112222], [3334445555], [6667778888]
      ];

      await addressBook.bulkAddContacts(firstNames, lastNames, phoneNumbers);
    });

    it("should bulk delete contacts successfully", async function () {
      const idsToDelete = [1, 3];

      await expect(addressBook.bulkDeleteContacts(idsToDelete))
        .to.emit(addressBook, "BulkContactsDeleted")
        .withArgs(2);

      // Verify contacts were deleted
      await expect(addressBook.getContact(1)).to.be.revertedWith("ContactNotFound");
      await expect(addressBook.getContact(3)).to.be.revertedWith("ContactNotFound");

      // Verify remaining contacts still exist
      const contact2 = await addressBook.getContact(2);
      const contact4 = await addressBook.getContact(4);

      expect(contact2.firstName).to.equal("Jane");
      expect(contact4.firstName).to.equal("Alice");
    });

    it("should handle deleting non-existent contacts gracefully", async function () {
      const idsToDelete = [1, 99, 3, 100]; // Mix of valid and invalid IDs

      await expect(addressBook.bulkDeleteContacts(idsToDelete))
        .to.emit(addressBook, "BulkContactsDeleted")
        .withArgs(2); // Only 2 valid contacts deleted
    });

    it("should handle maximum bulk delete limit", async function () {
      const maxDelete = await addressBook.MAX_BULK_DELETE();

      // Add more contacts to test maximum deletion
      const additionalFirstNames = Array(Number(maxDelete) - 4).fill().map((_, i) => `Extra${i}`);
      const additionalLastNames = Array(Number(maxDelete) - 4).fill().map((_, i) => `User${i}`);
      const additionalPhoneNumbers = Array(Number(maxDelete) - 4).fill().map(() => [1112223333]);

      await addressBook.bulkAddContacts(additionalFirstNames, additionalLastNames, additionalPhoneNumbers);

      // Try to delete maximum allowed
      const allContacts = await addressBook.getAllContacts();
      const idsToDelete = allContacts.slice(0, Number(maxDelete)).map(contact => contact.id);

      await expect(addressBook.bulkDeleteContacts(idsToDelete))
        .to.emit(addressBook, "BulkContactsDeleted");
    });
  });

  describe("Bulk Contact Retrieval", function () {
    beforeEach(async function () {
      // Add test contacts
      const firstNames = ["John", "Jane", "Bob", "Alice", "Charlie"];
      const lastNames = ["Doe", "Smith", "Johnson", "Brown", "Wilson"];
      const phoneNumbers = [
        [1234567890], [5551112222], [3334445555], [6667778888], [9990001111]
      ];

      await addressBook.bulkAddContacts(firstNames, lastNames, phoneNumbers);
    });

    it("should bulk retrieve contacts by IDs", async function () {
      const idsToRetrieve = [1, 3, 5];

      const retrievedContacts = await addressBook.bulkGetContacts(idsToRetrieve);

      expect(retrievedContacts.length).to.equal(3);
      expect(retrievedContacts[0].firstName).to.equal("John");
      expect(retrievedContacts[1].firstName).to.equal("Bob");
      expect(retrievedContacts[2].firstName).to.equal("Charlie");
    });

    it("should handle retrieving non-existent contacts", async function () {
      const idsToRetrieve = [1, 99, 3]; // Mix of valid and invalid IDs

      const retrievedContacts = await addressBook.bulkGetContacts(idsToRetrieve);

      expect(retrievedContacts.length).to.equal(3);
      expect(retrievedContacts[0].firstName).to.equal("John");
      expect(retrievedContacts[1].id).to.equal(0); // Default value for non-existent
      expect(retrievedContacts[2].firstName).to.equal("Bob");
    });

    it("should retrieve contacts in range", async function () {
      const contactsRange = await addressBook.getContactsRange(1, 3);

      expect(contactsRange.length).to.equal(3);
      expect(contactsRange[0].firstName).to.equal("John");
      expect(contactsRange[1].firstName).to.equal("Jane");
      expect(contactsRange[2].firstName).to.equal("Bob");
    });

    it("should reject invalid range requests", async function () {
      await expect(addressBook.getContactsRange(10, 5))
        .to.be.revertedWith("Start index out of bounds");

      await expect(addressBook.getContactsRange(0, 100))
        .to.be.revertedWith("Range exceeds array length");
    });

    it("should handle maximum bulk retrieve limit", async function () {
      const maxRetrieve = await addressBook.MAX_BULK_RETRIEVE();
      const idsToRetrieve = Array(Number(maxRetrieve)).fill().map((_, i) => (i % 5) + 1);

      const retrievedContacts = await addressBook.bulkGetContacts(idsToRetrieve);
      expect(retrievedContacts.length).to.equal(Number(maxRetrieve));
    });
  });

  describe("Bulk Contact Updates", function () {
    beforeEach(async function () {
      // Add test contacts
      const firstNames = ["John", "Jane"];
      const lastNames = ["Doe", "Smith"];
      const phoneNumbers = [
        [1234567890, 9876543210],
        [5551112222]
      ];

      await addressBook.bulkAddContacts(firstNames, lastNames, phoneNumbers);
    });

    it("should bulk update phone numbers", async function () {
      const idsToUpdate = [1, 2];
      const newPhoneNumbers = [
        [1112223333, 4445556666, 7778889999], // Add more numbers to John
        [1234567890, 9876543210, 5551112222]  // Add more numbers to Jane
      ];

      await addressBook.bulkUpdatePhoneNumbers(idsToUpdate, newPhoneNumbers);

      const updatedContact1 = await addressBook.getContact(1);
      const updatedContact2 = await addressBook.getContact(2);

      expect(updatedContact1.phoneNumbers.length).to.equal(3);
      expect(updatedContact2.phoneNumbers.length).to.equal(3);
    });

    it("should reject bulk update for non-existent contacts", async function () {
      const idsToUpdate = [1, 99];
      const newPhoneNumbers = [
        [1112223333],
        [4445556666]
      ];

      await expect(addressBook.bulkUpdatePhoneNumbers(idsToUpdate, newPhoneNumbers))
        .to.be.revertedWith("Contact not found");
    });
  });

  describe("Contact Search", function () {
    beforeEach(async function () {
      // Add test contacts with searchable names
      const firstNames = ["John", "Jane", "Bob", "Alice", "Charlie"];
      const lastNames = ["Doe", "Smith", "Johnson", "Brown", "Wilson"];
      const phoneNumbers = [
        [1234567890], [5551112222], [3334445555], [6667778888], [9990001111]
      ];

      await addressBook.bulkAddContacts(firstNames, lastNames, phoneNumbers);
    });

    it("should search contacts by first name", async function () {
      const results = await addressBook.searchContacts("John", 10);

      expect(results.length).to.equal(1);
      expect(results[0]).to.equal(1); // John Doe's ID
    });

    it("should search contacts by last name", async function () {
      const results = await addressBook.searchContacts("Smith", 10);

      expect(results.length).to.equal(1);
      expect(results[0]).to.equal(2); // Jane Smith's ID
    });

    it("should perform case-insensitive search", async function () {
      const results = await addressBook.searchContacts("JOHN", 10);

      expect(results.length).to.equal(1);
      expect(results[0]).to.equal(1); // Should find John despite case difference
    });

    it("should search for partial matches", async function () {
      const results = await addressBook.searchContacts("Jo", 10);

      expect(results.length).to.equal(2);
      expect(results).to.include(1); // John
      expect(results).to.include(3); // Bob Johnson (contains "Jo")
    });

    it("should limit search results", async function () {
      // Add more contacts that match "a" to test limiting
      const firstNames = ["Anna", "Sara", "Laura"];
      const lastNames = ["Adams", "Allen", "Anderson"];
      const phoneNumbers = [[1111111111], [2222222222], [3333333333]];

      await addressBook.bulkAddContacts(firstNames, lastNames, phoneNumbers);

      const results = await addressBook.searchContacts("a", 2);

      expect(results.length).to.equal(2); // Limited to 2 results
    });

    it("should return empty array for no matches", async function () {
      const results = await addressBook.searchContacts("NonExistentName", 10);

      expect(results.length).to.equal(0);
    });
  });

  describe("Statistics and Analytics", function () {
    beforeEach(async function () {
      // Add test contacts with varying phone numbers
      const firstNames = ["John", "Jane", "Bob"];
      const lastNames = ["Doe", "Smith", "Johnson"];
      const phoneNumbers = [
        [1234567890, 9876543210], // 2 numbers
        [5551112222],             // 1 number
        [3334445555, 6667778888, 9990001111] // 3 numbers
      ];

      await addressBook.bulkAddContacts(firstNames, lastNames, phoneNumbers);
    });

    it("should calculate contact statistics correctly", async function () {
      const stats = await addressBook.getContactStats();

      expect(stats.totalContacts).to.equal(3);
      expect(stats.totalPhoneNumbers).to.equal(6); // 2 + 1 + 3
      expect(stats.averagePhonesPerContact).to.equal(2); // 6 / 3
    });

    it("should return zero averages for empty address book", async function () {
      // Deploy a new empty address book for this test
      const AddressBook = await ethers.getContractFactory("AddressBook");
      const emptyAddressBook = await AddressBook.deploy();
      await emptyAddressBook.waitForDeployment();

      const stats = await emptyAddressBook.getContactStats();

      expect(stats.totalContacts).to.equal(0);
      expect(stats.totalPhoneNumbers).to.equal(0);
      expect(stats.averagePhonesPerContact).to.equal(0);
    });
  });

  describe("Gas Estimation", function () {
    it("should estimate gas for add operations", async function () {
      const gasEstimate = await addressBook.estimateBulkGas(5, 0); // 5 add operations

      expect(gasEstimate).to.be.gt(21000); // Should be more than base gas
    });

    it("should estimate gas for retrieve operations", async function () {
      const gasEstimate = await addressBook.estimateBulkGas(10, 2); // 10 retrieve operations

      expect(gasEstimate).to.be.gt(21000);
    });

    it("should estimate gas for update operations", async function () {
      const gasEstimate = await addressBook.estimateBulkGas(3, 3); // 3 update operations

      expect(gasEstimate).to.be.gt(21000);
    });

    it("should reject invalid operation types", async function () {
      await expect(addressBook.estimateBulkGas(5, 99))
        .to.be.revertedWith("Invalid operation type");
    });
  });

  describe("Bulk Limits", function () {
    it("should return correct bulk operation limits", async function () {
      const limits = await addressBook.getBulkLimits();

      expect(limits.maxBulkAdd).to.equal(25);
      expect(limits.maxBulkDelete).to.equal(30);
      expect(limits.maxBulkRetrieve).to.equal(50);
    });
  });

  describe("Integration Tests", function () {
    it("should handle complete bulk workflow", async function () {
      // 1. Bulk add contacts
      const firstNames = ["Alice", "Bob", "Charlie", "Diana"];
      const lastNames = ["Wonder", "Builder", "Chaplin", "Prince"];
      const phoneNumbers = [
        [1111111111, 2222222222],
        [3333333333],
        [4444444444, 5555555555],
        [6666666666, 7777777777, 8888888888]
      ];

      await addressBook.bulkAddContacts(firstNames, lastNames, phoneNumbers);

      // 2. Bulk retrieve some contacts
      const idsToRetrieve = [1, 3];
      const retrievedContacts = await addressBook.bulkGetContacts(idsToRetrieve);

      expect(retrievedContacts[0].firstName).to.equal("Alice");
      expect(retrievedContacts[1].firstName).to.equal("Charlie");

      // 3. Bulk update phone numbers
      const idsToUpdate = [2, 4];
      const newPhoneNumbers = [
        [9999999999, 0000000000, 1111111111], // Update Bob
        [2222222222] // Update Diana
      ];

      await addressBook.bulkUpdatePhoneNumbers(idsToUpdate, newPhoneNumbers);

      // 4. Search for contacts
      const searchResults = await addressBook.searchContacts("Char", 10);
      expect(searchResults).to.include(3); // Charlie Chaplin

      // 5. Bulk delete some contacts
      const idsToDelete = [1, 4]; // Delete Alice and Diana
      await addressBook.bulkDeleteContacts(idsToDelete);

      // 6. Verify final state
      const finalStats = await addressBook.getContactStats();
      expect(finalStats.totalContacts).to.equal(2); // Bob and Charlie remain

      // Verify remaining contacts still exist
      const bob = await addressBook.getContact(2);
      const charlie = await addressBook.getContact(3);

      expect(bob.firstName).to.equal("Bob");
      expect(charlie.firstName).to.equal("Charlie");
      expect(bob.phoneNumbers.length).to.equal(3); // Updated phone numbers
    });

    it("should handle bulk operations with mixed valid/invalid inputs", async function () {
      // Add initial contacts
      const firstNames = ["Valid1", "Valid2"];
      const lastNames = ["User1", "User2"];
      const phoneNumbers = [[1111111111], [2222222222]];

      await addressBook.bulkAddContacts(firstNames, lastNames, phoneNumbers);

      // Try bulk operations with some invalid inputs
      const idsToUpdate = [1, 99, 2]; // 99 is invalid
      const newPhoneNumbers = [
        [3333333333],
        [4444444444],
        [5555555555]
      ];

      await expect(addressBook.bulkUpdatePhoneNumbers(idsToUpdate, newPhoneNumbers))
        .to.be.revertedWith("Contact not found");

      // Bulk delete with mixed valid/invalid IDs
      const idsToDelete = [1, 999, 2, 1000];
      await addressBook.bulkDeleteContacts(idsToDelete); // Should succeed for valid IDs

      // Verify valid contacts were deleted
      await expect(addressBook.getContact(1)).to.be.revertedWith("ContactNotFound");
      await expect(addressBook.getContact(2)).to.be.revertedWith("ContactNotFound");
    });
  });

  describe("Access Control", function () {
    it("should only allow owner to perform bulk operations", async function () {
      const firstNames = ["Test"];
      const lastNames = ["User"];
      const phoneNumbers = [[1234567890]];

      // Try bulk add from non-owner
      await expect(addressBook.connect(user1).bulkAddContacts(firstNames, lastNames, phoneNumbers))
        .to.be.revertedWith("Ownable: caller is not the owner");

      // Try bulk delete from non-owner
      await expect(addressBook.connect(user1).bulkDeleteContacts([1]))
        .to.be.revertedWith("Ownable: caller is not the owner");

      // Try bulk update from non-owner
      await expect(addressBook.connect(user1).bulkUpdatePhoneNumbers([1], [[9999999999]]))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should allow anyone to read contacts", async function () {
      // Add a contact as owner
      await addressBook.addContact("Test", "User", [1234567890]);

      // Try to read as non-owner - should succeed
      const contact = await addressBook.connect(user1).getContact(1);
      expect(contact.firstName).to.equal("Test");

      // Try bulk retrieve as non-owner - should succeed
      const contacts = await addressBook.connect(user1).bulkGetContacts([1]);
      expect(contacts[0].firstName).to.equal("Test");
    });
  });
});
